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
