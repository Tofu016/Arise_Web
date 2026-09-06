// Shared HTTP client for the new CodeIgniter backend — every rewritten
// hook goes through this rather than calling fetch() directly, same
// reasoning as MY_Controller on the PHP side: build the shared,
// repeated part once, well, and every future resource reuses it.
//
// The auth token is read from localStorage under "authToken". Nothing
// in this file sets it yet — that's the login flow's job, which hasn't
// been rewired yet (AuthContext.jsx still runs on Firebase). Until
// that's done, set it manually for testing via the browser console:
//   localStorage.setItem("authToken", "paste-a-real-token-here")

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost/Arise_API/index.php";

function getToken() {
  return localStorage.getItem("authToken");
}

async function apiRequest(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // The backend always returns JSON, including on 400/401/403/409
  // errors — those are genuine, informative responses, not failures to
  // parse, so this always attempts to read the body before deciding
  // whether the request itself succeeded.
  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || "Request failed.");
  }
  return data;
}

export const apiGet = (path) => apiRequest("GET", path);
export const apiPost = (path, body) => apiRequest("POST", path, body);
export const apiPatch = (path, body) => apiRequest("PATCH", path, body);
export const apiDelete = (path) => apiRequest("DELETE", path);
