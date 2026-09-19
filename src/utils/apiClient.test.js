import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { API_BASE_URL, apiGet, apiPost, apiDelete, apiUpload, apiGetBlob } from "./apiClient";

// The seam under test is the global fetch: stubbed once here, instead of
// once per caller.
let fetchMock;
let storage;

function jsonResponse(body, ok = true) {
  return { ok, json: async () => body };
}

beforeEach(() => {
  storage = {};
  vi.stubGlobal("localStorage", {
    getItem: (k) => (k in storage ? storage[k] : null),
    setItem: (k, v) => {
      storage[k] = v;
    },
  });
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("JSON requests", () => {
  it("targets the base URL and attaches the bearer token", async () => {
    storage.authToken = "tok";
    fetchMock.mockResolvedValue(jsonResponse({ success: true, nodes: [] }));

    const data = await apiGet("Nodes_API/getAll");

    expect(data.nodes).toEqual([]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/Nodes_API/getAll`);
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(init.body).toBeUndefined();
  });

  it("omits Authorization when there is no token", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));
    await apiGet("x");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it("sends a JSON body on POST", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));
    await apiPost("Nodes_API/create", { a: 1 });
    const init = fetchMock.mock.calls[0][1];
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
  });

  it("supports a JSON body on DELETE", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));
    await apiDelete("Photos_API/delete", { path: "a/b.jpg" });
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe("DELETE");
    expect(init.body).toBe(JSON.stringify({ path: "a/b.jpg" }));
  });

  it("throws the server's error, even on a non-2xx response", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: false, error: "Nope" }, false));
    await expect(apiGet("x")).rejects.toThrow("Nope");
  });

  it("falls back to the caller's message, then the default", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: false }));
    await expect(apiDelete("x", undefined, "Couldn't delete.")).rejects.toThrow("Couldn't delete.");
    await expect(apiGet("x")).rejects.toThrow("Request failed.");
  });
});

describe("apiUpload", () => {
  it("posts the FormData without a manual Content-Type", async () => {
    storage.authToken = "tok";
    fetchMock.mockResolvedValue(jsonResponse({ success: true, path: "roomphoto/gd1/a.jpg" }));
    const formData = new FormData();
    formData.append("filename", "a.jpg");

    const data = await apiUpload("IndoorUploads_API/roomPhoto", formData);

    expect(data.path).toBe("roomphoto/gd1/a.jpg");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/IndoorUploads_API/roomPhoto`);
    expect(init.method).toBe("POST");
    expect(init.body).toBe(formData);
    expect(init.headers["Content-Type"]).toBeUndefined();
    expect(init.headers.Authorization).toBe("Bearer tok");
  });

  it("throws 'Upload failed.' by default", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: false }));
    await expect(apiUpload("x", new FormData())).rejects.toThrow("Upload failed.");
  });
});

describe("apiGetBlob", () => {
  it("returns the blob with the bearer token attached", async () => {
    storage.authToken = "tok";
    const blob = new Blob(["bytes"]);
    fetchMock.mockResolvedValue({ ok: true, blob: async () => blob });

    expect(await apiGetBlob("IndoorUploads_API/serve?path=p")).toBe(blob);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer tok");
  });

  it("throws the caller's message on a non-ok status", async () => {
    fetchMock.mockResolvedValue({ ok: false });
    await expect(apiGetBlob("x", "Couldn't load photo.")).rejects.toThrow("Couldn't load photo.");
  });
});
