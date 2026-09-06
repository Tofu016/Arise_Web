const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost/Arise_API/index.php";

function getToken() {
  return localStorage.getItem("authToken");
}

// Rewritten to call IndoorUploads_API instead of Firebase Storage. Same
// temporary-holding-area purpose as before — a not-yet-reviewed
// (potentially unblurred) photo shouldn't be reachable through the
// normal viewing path until an admin actually confirms it — just no
// longer motivated by "give detectFaces something to scan," since that
// step is gone entirely now that blurring is manual-only.
export async function uploadForReview(file, building, filename) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("building", building);
  formData.append("filename", filename);

  const headers = {};
  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/IndoorUploads_API/panoramaReview`, {
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

// Cleans up the temp file once review is done (confirmed or cancelled).
// Best-effort, same as before — a leftover temp file is a minor storage
// cost, not worth failing the whole flow over if deletion itself has a
// transient error.
export async function deleteReviewFile(path) {
  try {
    const headers = { "Content-Type": "application/json" };
    const token = getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    await fetch(`${API_BASE_URL}/IndoorUploads_API/deleteReviewFile`, {
      method: "POST",
      headers,
      body: JSON.stringify({ path }),
    });
  } catch {
    // ignore
  }
}
