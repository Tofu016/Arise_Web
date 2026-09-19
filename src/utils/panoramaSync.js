import { apiUpload } from "./apiClient";

// Rewritten to call IndoorUploads_API's panoramaPublish endpoint instead
// of Firebase Storage. Same panoramas/{building}/{filename} path shape,
// same "publish the reviewed/blurred version under its real, permanent
// name" purpose — used both for a brand-new upload's final publish step
// and for overwriting in place when re-reviewing an already-published
// photo (NodeForm.jsx's own handleReviewConfirm calls this the same way
// in both cases, just with a different filename source).
export async function copyPanoramaFile(file, building, filename) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("building", building);
  formData.append("filename", filename);

  const data = await apiUpload("IndoorUploads_API/panoramaPublish", formData);
  return { path: data.path };
}
