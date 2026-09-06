const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost/Arise_API/index.php";

function getToken() {
  return localStorage.getItem("authToken");
}

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

  const headers = {};
  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/IndoorUploads_API/panoramaPublish`, {
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
