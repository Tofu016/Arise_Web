import { convertImage } from "./imageConverter";
import { apiUpload } from "./apiClient";

// Rewritten to upload to TourUploads_API instead of Firebase Storage.
// Same three path prefixes preserved (tourpanorama/, tourcover/,
// tourmarker/) — see TourUploads_API's own comment for why that
// consistency matters for useSecurePhotoUrl.js's hybrid resolution.

async function uploadFile(endpoint, file, filename) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("filename", filename);

  const data = await apiUpload(`TourUploads_API/${endpoint}`, formData);
  return { path: data.path };
}

// Converts to a standard, backend-accepted format — no resizing anymore
// (see imageConverter.js's own comment for the trade-off this makes).
export async function uploadTourPanorama(file, filename) {
  const converted = await convertImage(file);
  return uploadFile("panorama", converted, filename);
}

export async function uploadTourSectionCover(file, filename) {
  return uploadFile("cover", file, filename);
}

export async function uploadTourMarkerPhoto(file, filename) {
  return uploadFile("marker", file, filename);
}
