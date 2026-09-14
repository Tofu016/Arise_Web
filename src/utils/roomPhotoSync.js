import { convertImage } from "./imageConverter";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost/Arise_API/index.php";

// Rewritten to upload to IndoorUploads_API instead of Firebase Storage.
// Same multipart/FormData approach as tourPhotoSync.js's own rewrite —
// see that file's comment for why this doesn't reuse apiClient.js's
// JSON-based helpers. Files land in a genuinely protected location this
// time (outside htdocs entirely), not a publicly-servable one — viewing
// them goes through IndoorUploads_API's own serve() endpoint, which
// useSecurePhotoUrl.js's own rewrite calls with the current auth token.

function getToken() {
  return localStorage.getItem("authToken");
}

async function uploadFile(endpoint, file, building, filename) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("building", building);
  formData.append("filename", filename);

  const headers = {};
  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/IndoorUploads_API/${endpoint}`, {
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

export async function uploadRoomPhoto(file, building, filename) {
  return uploadFile("roomPhoto", file, building, filename);
}

export async function uploadRoom360Photo(file, building, filename) {
  const converted = await convertImage(file);
  return uploadFile("room360Photo", converted, building, filename);
}
