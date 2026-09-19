import { convertImage } from "./imageConverter";
import { apiUpload } from "./apiClient";

// Rewritten to upload to IndoorUploads_API instead of Firebase Storage.
// Files land in a genuinely protected location this time (outside
// htdocs entirely), not a publicly-servable one — viewing them goes
// through IndoorUploads_API's own serve() endpoint, which
// useSecurePhotoUrl.js's own rewrite calls with the current auth token.

async function uploadFile(endpoint, file, building, filename) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("building", building);
  formData.append("filename", filename);

  const data = await apiUpload(`IndoorUploads_API/${endpoint}`, formData);
  return { path: data.path };
}

export async function uploadRoomPhoto(file, building, filename) {
  return uploadFile("roomPhoto", file, building, filename);
}

export async function uploadRoom360Photo(file, building, filename) {
  const converted = await convertImage(file);
  return uploadFile("room360Photo", converted, building, filename);
}
