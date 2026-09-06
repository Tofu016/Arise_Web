import { resizeImageIfNeeded } from "./imageResize";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost/Arise_API/index.php";

// Rewritten to upload to TourUploads_API instead of Firebase Storage.
// Genuinely different request shape from apiClient.js's own
// apiPost/apiPatch — those send JSON bodies, this sends real binary
// file data as multipart/form-data, so this doesn't reuse that helper
// at all, it builds its own fetch() call with a FormData body instead.
// Same three path prefixes preserved (tourpanorama/, tourcover/,
// tourmarker/) — see TourUploads_API's own comment for why that
// consistency matters for useSecurePhotoUrl.js's hybrid resolution.

function getToken() {
  return localStorage.getItem("authToken");
}

async function uploadFile(endpoint, file, filename) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("filename", filename);

  const headers = {};
  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  // No Content-Type header set manually — the browser sets its own
  // multipart/form-data boundary automatically when the body is a
  // FormData object; setting it by hand would break that boundary.

  const response = await fetch(`${API_BASE_URL}/TourUploads_API/${endpoint}`, {
    method: "POST",
    headers,
    body: formData,
  });

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || "Upload failed.");
  }
  return { path: data.path };
}

// Same resize-before-upload behavior as before, same reasoning
// (mobile decodes images in pure JS with no native fast path).
export async function uploadTourPanorama(file, filename) {
  const resized = await resizeImageIfNeeded(file);
  return uploadFile("panorama", resized, filename);
}

export async function uploadTourSectionCover(file, filename) {
  return uploadFile("cover", file, filename);
}

export async function uploadTourMarkerPhoto(file, filename) {
  return uploadFile("marker", file, filename);
}
