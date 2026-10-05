import { API_BASE_URL, apiGetBlob, apiUpload } from "./apiClient";
import { convertImage } from "./imageConverter";
import { createLimiter } from "./concurrencyLimiter";

// Every photo the app stores, in one table: which backend endpoint takes
// it, which storage-path prefix it lands under, and whether that prefix is
// public (a plain static file, no auth) or protected (served only through
// IndoorUploads_API's serve() endpoint, which checks nobody). Uploading and
// resolving a photo are the two halves of one rule, so both read this
// table — adding a kind means adding one row.
//
//   panorama      node panoramas (published version, after blur review)
//   roomPhoto     a room's photo
//   room360       a room's 360° photo
//   signage       kiosk bottom-band media (see utils/signage.js): images,
//                 animated GIFs and MP4/WebM video. Uploaded as picked
//                 (raw), since convertImage's canvas re-encode would
//                 flatten a GIF to one frame and can't read video at all.
const KINDS = {
  panorama: { endpoint: "IndoorUploads_API/panoramaPublish", prefix: "panoramas/", visibility: "protected" },
  roomPhoto: { endpoint: "IndoorUploads_API/roomPhoto", prefix: "roomphoto/", visibility: "protected" },
  room360: { endpoint: "IndoorUploads_API/room360Photo", prefix: "room360/", visibility: "protected" },
  signage: { endpoint: "Signage_API/upload", prefix: "signage/", visibility: "public", raw: true },
};

const UNSUPPORTED_PATH_MESSAGE =
  "This image uses an old storage path that's no longer supported. Re-upload it from the editor.";

// Names an upload after `basename` plus the picked file's real extension,
// so re-uploading a replacement for the same thing cleanly overwrites the
// same file instead of leaving copies under their original names. Falls
// back to the original filename when there's nothing to key off of.
export function photoFilename(file, basename) {
  if (!basename) return file.name;
  const dot = file.name.lastIndexOf(".");
  return dot !== -1 ? `${basename}${file.name.slice(dot)}` : basename;
}

// Converts to a backend-accepted format (see imageConverter.js — a no-op
// for files that are already WebP), then uploads under the kind's
// endpoint. `building` is required by the indoor kinds only. Returns
// { path }, the storage path to save on the record.
export async function uploadPhoto(kind, file, { filename, building } = {}) {
  const spec = KINDS[kind];
  if (!spec) throw new Error(`Unknown photo kind: ${kind}`);

  const converted = spec.raw ? file : await convertImage(file);
  const formData = new FormData();
  formData.append("file", converted);
  if (building !== undefined) formData.append("building", building);
  formData.append("filename", filename);

  const data = await apiUpload(spec.endpoint, formData);
  invalidatePhoto(data.path); // a re-upload overwrites the same path
  return { path: data.path };
}

function specForPath(path) {
  return Object.values(KINDS).find((spec) => path.startsWith(spec.prefix)) || null;
}

// Caps how many protected-photo requests are ever in flight at once — pages
// that mount many nodes at the same time (e.g. the node flowchart with many
// buildings/floors in scope) would otherwise fire a full-resolution
// panorama fetch+decode per node simultaneously and stall the main thread.
const protectedPhotoLimiter = createLimiter(4);

// Authenticated read of a protected photo's bytes. Exposed separately for
// the blur review, which needs the raw Blob rather than a display URL.
export function fetchProtectedPhoto(path, fallbackError = "Couldn't load photo.") {
  return protectedPhotoLimiter(() =>
    apiGetBlob(`IndoorUploads_API/serve?path=${encodeURIComponent(path)}`, fallbackError)
  );
}

// One of Photo_preview::WIDTHS on the backend — a request for any other
// number is rejected there, so this is deliberately the same fixed list
// rather than an arbitrary caller-chosen size.
const THUMBNAIL_WIDTH = 320;

// Same as fetchProtectedPhoto, but asks the backend's serve() for its
// already-built-for-the-mobile-app downscaled JPEG (format=jpeg&width=)
// instead of the original. For a caller that only ever displays a photo at
// a few hundred CSS pixels (the node flowchart's thumbnails) — pulling down
// and decoding the full multi-MB panorama just to shrink it in CSS wastes
// both. The backend caches the converted copy on disk, so repeat requests
// for the same photo are cheap after the first.
//
// `width` must be one of Photo_preview::WIDTHS. A 360 photo is shown as a
// small crop of itself, so it asks for a wider copy than a flat one.
export function fetchProtectedPhotoThumbnail(path, fallbackError = "Couldn't load photo.", width = THUMBNAIL_WIDTH) {
  const query = `path=${encodeURIComponent(path)}&format=jpeg&width=${width}`;
  return protectedPhotoLimiter(() => apiGetBlob(`IndoorUploads_API/serve?${query}`, fallbackError));
}

// The direct static URL of a public photo (no auth, no fetch), for a
// caller that needs a plain src synchronously, like the kiosk's signage.
export function publicPhotoUrl(path) {
  return `${API_BASE_URL.replace(/\/index\.php$/, "")}/uploads/${path}`;
}

// The raw bytes of any stored photo, for editing it (the blur review).
// Protected photos come through the authenticated serve endpoint; public
// ones are plain static files. no-cache so an edit made a moment ago isn't
// read back stale from the browser cache.
export async function fetchPhotoBlob(path) {
  const spec = specForPath(path);
  if (!spec) throw new Error(UNSUPPORTED_PATH_MESSAGE);
  if (spec.visibility === "protected") {
    return fetchProtectedPhoto(path, "Couldn't load the existing photo.");
  }
  const response = await fetch(publicPhotoUrl(path), { cache: "no-cache" });
  if (!response.ok) throw new Error("Couldn't load the existing photo.");
  return response.blob();
}

// Saves edited bytes back over an existing photo, under the same category,
// building and name, so everything already pointing at it keeps working.
// Returns { path } — normally the same path. It differs only when the new
// file's format doesn't match the old extension (e.g. an old .jpg re-saved
// as .webp); the caller must then point its record at the new path.
export async function reuploadPhoto(path, blob) {
  const spec = specForPath(path);
  if (!spec) throw new Error(UNSUPPORTED_PATH_MESSAGE);
  const kind = Object.keys(KINDS).find((k) => KINDS[k] === spec);
  const segments = path.split("/");
  const perBuilding = segments.length === 3; // category/building/file vs category/file
  return uploadPhoto(kind, blob, {
    filename: segments[segments.length - 1],
    ...(perBuilding ? { building: segments[1] } : {}),
  });
}

// Resolves a stored photo path to something an <img> can display:
// { url, release }. Public paths resolve to a direct static URL; protected
// paths are fetched with the current auth token into a blob: URL, which
// `release()` revokes. Rejects for a path matching no known kind.
export async function loadPhoto(path) {
  const spec = specForPath(path);
  if (!spec) throw new Error(UNSUPPORTED_PATH_MESSAGE);

  if (spec.visibility === "public") {
    return { url: publicPhotoUrl(path), release() {} };
  }

  const blob = await fetchProtectedPhoto(path);
  const url = URL.createObjectURL(blob);
  return { url, release: () => URL.revokeObjectURL(url) };
}

// Same shape and contract as loadPhoto, but resolves to a small downscaled
// copy instead of the original — for a caller that only ever shows the
// photo tiny (the node flowchart). Public kinds fall back to the ordinary
// resolution: serve()'s format/width params only apply to protected photos,
// since public ones are served straight from disk by Apache, never through
// serve() at all.
export async function loadPhotoThumbnail(path, width) {
  const spec = specForPath(path);
  if (!spec) throw new Error(UNSUPPORTED_PATH_MESSAGE);

  if (spec.visibility === "public") {
    return { url: publicPhotoUrl(path), release() {} };
  }

  const blob = await fetchProtectedPhotoThumbnail(path, undefined, width);
  const url = URL.createObjectURL(blob);
  return { url, release: () => URL.revokeObjectURL(url) };
}

// Session cache for thumbnails (the directory's cell photos), which are small
// and shared by every row that shows them: kept for the whole session so a row
// that scrolls back, an accordion that reopens, or the background preload
// (useDirectoryThumbnailPreload) costs no fetch. Never revoked, unlike
// acquirePhoto's entries; an entry older than THUMBNAIL_TTL_MS is refetched so
// a replaced photo is eventually picked up. Same contract as loadPhotoThumbnail.
const THUMBNAIL_TTL_MS = 30 * 60 * 1000;
const thumbnailCache = new Map(); // "path|width" -> { promise, at }

export function acquireThumbnail(path, width) {
  const key = `${path}|${width ?? ""}`;
  let entry = thumbnailCache.get(key);
  if (!entry || Date.now() - entry.at > THUMBNAIL_TTL_MS) {
    const created = {
      at: Date.now(),
      promise: loadPhotoThumbnail(path, width).then(({ url }) => ({ url, release() {} })),
    };
    created.promise.catch(() => {
      if (thumbnailCache.get(key) === created) thumbnailCache.delete(key);
    });
    thumbnailCache.set(key, created);
    entry = created;
  }
  return entry.promise;
}

// Opt-in session cache over loadPhoto, for the visitor view where the same
// ~7.5 MB panoramas are revisited and prefetched ahead of a move. Entries
// are reference-counted: a photo in use is never revoked, and once released
// it lingers (up to MAX_IDLE_PHOTOS of them, oldest evicted first) so going
// back, or moving to a prefetched neighbor, costs no fetch. An idle entry
// older than PHOTO_TTL_MS is refetched rather than reused, so a long-running
// kiosk still picks up a panorama an admin has since replaced.
const MAX_IDLE_PHOTOS = 8;
const PHOTO_TTL_MS = 10 * 60 * 1000;
const photoCache = new Map(); // path -> { promise, loaded, refs, at }; insertion order = recency

function evictEntry(path, entry) {
  if (photoCache.get(path) === entry) photoCache.delete(path);
  entry.loaded?.release();
}

function evictIdlePhotos() {
  const idle = [...photoCache].filter(([, e]) => e.refs === 0 && e.loaded);
  for (const [path, entry] of idle.slice(0, Math.max(0, idle.length - MAX_IDLE_PHOTOS))) {
    evictEntry(path, entry);
  }
}

// Same contract as loadPhoto ({ url, release }), served from the cache when
// possible. Every call must be balanced by its release().
export async function acquirePhoto(path) {
  let entry = photoCache.get(path);
  if (entry && entry.refs === 0 && entry.loaded && Date.now() - entry.at > PHOTO_TTL_MS) {
    evictEntry(path, entry);
    entry = undefined;
  }
  if (!entry) {
    entry = { refs: 0, loaded: null, at: Date.now(), promise: loadPhoto(path) };
    const created = entry;
    created.promise.then(
      (loaded) => { created.loaded = loaded; },
      () => { if (photoCache.get(path) === created) photoCache.delete(path); }
    );
  } else {
    photoCache.delete(path); // re-insert below to mark it most recent
  }
  photoCache.set(path, entry);
  entry.refs++;

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    entry.refs--;
    if (entry.orphaned && entry.refs === 0) entry.loaded?.release();
    evictIdlePhotos();
  };
  try {
    const loaded = await entry.promise;
    return { url: loaded.url, release };
  } catch (err) {
    release();
    throw err;
  }
}

// Warms the cache for a photo the visitor is likely to open next. Never
// rejects; resolves once it has loaded (or failed).
export async function prefetchPhoto(path) {
  try {
    (await acquirePhoto(path)).release();
  } catch {
    // A failed prefetch just means the real load happens on demand.
  }
}

// Drops a path from the cache (its holders keep their URL until they release).
export function invalidatePhoto(path) {
  const entry = photoCache.get(path);
  if (!entry) return;
  photoCache.delete(path);
  entry.orphaned = true;
  if (entry.refs === 0) entry.promise.then((loaded) => loaded.release(), () => {});
}
