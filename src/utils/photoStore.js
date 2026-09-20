import { API_BASE_URL, apiGetBlob, apiUpload } from "./apiClient";
import { convertImage } from "./imageConverter";

// Every photo the app stores, in one table: which backend endpoint takes
// it, which storage-path prefix it lands under, and whether that prefix is
// public (a plain static file, no auth) or protected (served only through
// IndoorUploads_API's serve() endpoint after a role check). Uploading and
// resolving a photo are the two halves of one rule, so both read this
// table — adding a kind means adding one row.
//
//   panorama      node panoramas (published version, after blur review)
//   roomPhoto     a room's photo
//   room360       a room's 360° photo
//   tourPanorama  outdoor tour stop panoramas
//   tourCover     tour section cover photos
//   tourMarker    tour marker photos
const KINDS = {
  panorama: { endpoint: "IndoorUploads_API/panoramaPublish", prefix: "panoramas/", visibility: "protected" },
  roomPhoto: { endpoint: "IndoorUploads_API/roomPhoto", prefix: "roomphoto/", visibility: "protected" },
  room360: { endpoint: "IndoorUploads_API/room360Photo", prefix: "room360/", visibility: "protected" },
  tourPanorama: { endpoint: "TourUploads_API/panorama", prefix: "tourpanorama/", visibility: "public" },
  tourCover: { endpoint: "TourUploads_API/cover", prefix: "tourcover/", visibility: "public" },
  tourMarker: { endpoint: "TourUploads_API/marker", prefix: "tourmarker/", visibility: "public" },
};

const UNSUPPORTED_PATH_MESSAGE =
  "This image uses an old storage path that's no longer supported — re-upload it from the editor.";

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

  const converted = await convertImage(file);
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

// Authenticated read of a protected photo's bytes. Exposed separately for
// the blur review, which needs the raw Blob rather than a display URL.
export function fetchProtectedPhoto(path, fallbackError = "Couldn't load photo.") {
  return apiGetBlob(`IndoorUploads_API/serve?path=${encodeURIComponent(path)}`, fallbackError);
}

// Resolves a stored photo path to something an <img> can display:
// { url, release }. Public paths resolve to a direct static URL; protected
// paths are fetched with the current auth token into a blob: URL, which
// `release()` revokes. Rejects for a path matching no known kind.
export async function loadPhoto(path) {
  const spec = specForPath(path);
  if (!spec) throw new Error(UNSUPPORTED_PATH_MESSAGE);

  if (spec.visibility === "public") {
    return {
      url: `${API_BASE_URL.replace(/\/index\.php$/, "")}/uploads/${path}`,
      release() {},
    };
  }

  const blob = await fetchProtectedPhoto(path);
  const url = URL.createObjectURL(blob);
  return { url, release: () => URL.revokeObjectURL(url) };
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
