// Shared HTTP client for the new CodeIgniter backend — every rewritten
// hook goes through this rather than calling fetch() directly, same
// reasoning as MY_Controller on the PHP side: build the shared,
// repeated part once, well, and every future resource reuses it.
//
// This module is the single owner of the backend base URL, the auth
// token (localStorage "authToken") and the error contract: JSON
// requests, multipart uploads and binary (blob) reads all attach the
// same bearer header, and every JSON response is checked for
// `success`, throwing the server's own `error` (or the caller's
// fallback message) when it is false.

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost/Arise_API/index.php";

function authHeaders(headers = {}) {
  const token = localStorage.getItem("authToken");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

// The backend always returns JSON, including on 400/401/403/409 errors —
// those are genuine, informative responses, not failures to parse, so
// this always attempts to read the body before deciding whether the
// request itself succeeded.
async function readJson(response, fallbackError) {
  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || fallbackError);
  }
  return data;
}

async function apiRequest(method, path, body, fallbackError = "Request failed.") {
  const response = await fetch(`${API_BASE_URL}/${path}`, {
    method,
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return readJson(response, fallbackError);
}

export const apiGet = (path, fallbackError) => apiRequest("GET", path, undefined, fallbackError);
export const apiPost = (path, body, fallbackError) => apiRequest("POST", path, body, fallbackError);
export const apiPatch = (path, body, fallbackError) => apiRequest("PATCH", path, body, fallbackError);
// `body` is optional — most deletes identify the row by an ID in the
// path, but a storage path contains slashes and can't be a URL segment,
// so those (e.g. Photos_API/delete) send it as a JSON body instead.
export const apiDelete = (path, body, fallbackError) => apiRequest("DELETE", path, body, fallbackError);

// Multipart upload — `formData` is a FormData holding the file and its
// metadata. No Content-Type header is set manually: the browser sets its
// own multipart/form-data boundary automatically when the body is a
// FormData object; setting it by hand would break that boundary.
export async function apiUpload(path, formData, fallbackError = "Upload failed.") {
  const response = await fetch(`${API_BASE_URL}/${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  });
  return readJson(response, fallbackError);
}

// Authenticated binary read, for endpoints that stream file bytes rather
// than JSON. Unlike the JSON helpers, failure here is signalled by the
// HTTP status alone.
export async function apiGetBlob(path, fallbackError = "Request failed.") {
  const response = await fetch(`${API_BASE_URL}/${path}`, {
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error(fallbackError);
  }
  return response.blob();
}
