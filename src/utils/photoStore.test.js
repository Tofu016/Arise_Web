import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Both collaborators are stubbed at their own seams: apiClient (the
// backend) and imageConverter (needs a real canvas).
vi.mock("./apiClient", () => ({
  API_BASE_URL: "http://host/api/index.php",
  apiUpload: vi.fn(),
  apiGetBlob: vi.fn(),
}));
vi.mock("./imageConverter", () => ({ convertImage: vi.fn(async (f) => f) }));

import { apiUpload, apiGetBlob } from "./apiClient";
import { convertImage } from "./imageConverter";
import { photoFilename, uploadPhoto, loadPhoto, acquirePhoto, prefetchPhoto, invalidatePhoto, fetchPhotoBlob, reuploadPhoto } from "./photoStore";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL: vi.fn() });
});
afterEach(() => vi.unstubAllGlobals());

describe("photoFilename", () => {
  it("keeps the picked file's extension", () => {
    expect(photoFilename({ name: "IMG_1.HEIC" }, "gd1_f1_hall_01")).toBe("gd1_f1_hall_01.HEIC");
  });
  it("handles a file with no extension", () => {
    expect(photoFilename({ name: "photo" }, "x")).toBe("x");
  });
  it("falls back to the original name without a basename", () => {
    expect(photoFilename({ name: "IMG_1.jpg" }, "")).toBe("IMG_1.jpg");
  });
});

describe("uploadPhoto", () => {
  it.each([
    ["panorama", "IndoorUploads_API/panoramaPublish"],
    ["roomPhoto", "IndoorUploads_API/roomPhoto"],
    ["room360", "IndoorUploads_API/room360Photo"],
    ["tourPanorama", "TourUploads_API/panorama"],
    ["tourCover", "TourUploads_API/cover"],
    ["tourMarker", "TourUploads_API/marker"],
  ])("%s goes to %s, converted first", async (kind, endpoint) => {
    apiUpload.mockResolvedValue({ path: "p/a.webp" });
    const file = new Blob(["x"]);

    const result = await uploadPhoto(kind, file, { filename: "a.webp", building: "gd1" });

    expect(result).toEqual({ path: "p/a.webp" });
    expect(convertImage).toHaveBeenCalledWith(file);
    const [path, formData] = apiUpload.mock.calls[0];
    expect(path).toBe(endpoint);
    expect(formData.get("filename")).toBe("a.webp");
    expect(formData.get("building")).toBe("gd1");
  });

  it("omits building for tour kinds", async () => {
    apiUpload.mockResolvedValue({ path: "tourcover/a.webp" });
    await uploadPhoto("tourCover", new Blob(["x"]), { filename: "a.webp" });
    expect(apiUpload.mock.calls[0][1].has("building")).toBe(false);
  });

  it("rejects an unknown kind", async () => {
    await expect(uploadPhoto("nope", new Blob(["x"]), { filename: "a" })).rejects.toThrow("Unknown photo kind");
  });
});

describe("loadPhoto", () => {
  it.each(["tourpanorama/a.jpg", "tourcover/a.jpg", "tourmarker/a.jpg"])(
    "%s resolves to a direct static URL with no fetch",
    async (path) => {
      const { url } = await loadPhoto(path);
      expect(url).toBe(`http://host/api/uploads/${path}`);
      expect(apiGetBlob).not.toHaveBeenCalled();
    }
  );

  it.each(["roomphoto/gd1/a.jpg", "room360/gd1/a.jpg", "panoramas/gd1/a.jpg"])(
    "%s is fetched through serve() into a revocable blob URL",
    async (path) => {
      apiGetBlob.mockResolvedValue(new Blob(["x"]));
      const loaded = await loadPhoto(path);
      expect(apiGetBlob.mock.calls[0][0]).toBe(`IndoorUploads_API/serve?path=${encodeURIComponent(path)}`);
      expect(loaded.url).toBe("blob:x");
      loaded.release();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:x");
    }
  );

  it("rejects a path matching no known kind", async () => {
    await expect(loadPhoto("https://old.example/o/x.jpg")).rejects.toThrow("no longer supported");
  });
});

describe("photo cache", () => {
  let n;
  beforeEach(() => {
    n = 0;
    apiGetBlob.mockImplementation(async () => new Blob(["x"]));
    URL.createObjectURL.mockImplementation(() => `blob:${++n}`);
  });

  it("serves a repeat acquire from memory, and revokes nothing while in use", async () => {
    const a = await acquirePhoto("panoramas/gd1/cached-a.jpg");
    const b = await acquirePhoto("panoramas/gd1/cached-a.jpg");
    expect(apiGetBlob).toHaveBeenCalledTimes(1);
    expect(b.url).toBe(a.url);
    a.release();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    b.release();
  });

  it("keeps a released photo for reuse, so a prefetched photo costs no fetch later", async () => {
    await prefetchPhoto("panoramas/gd1/cached-b.jpg");
    const held = await acquirePhoto("panoramas/gd1/cached-b.jpg");
    expect(apiGetBlob).toHaveBeenCalledTimes(1);
    held.release();
  });

  it("evicts and revokes the oldest idle photos past the cap", async () => {
    for (let i = 0; i < 10; i++) await prefetchPhoto(`panoramas/gd1/evict-${i}.jpg`);
    expect(URL.revokeObjectURL).toHaveBeenCalled();
    const fetched = apiGetBlob.mock.calls.length;
    (await acquirePhoto("panoramas/gd1/evict-9.jpg")).release(); // newest: still cached
    expect(apiGetBlob).toHaveBeenCalledTimes(fetched);
    (await acquirePhoto("panoramas/gd1/evict-0.jpg")).release(); // oldest: evicted, fetched again
    expect(apiGetBlob).toHaveBeenCalledTimes(fetched + 1);
  });

  it("does not cache a failed load", async () => {
    apiGetBlob.mockRejectedValueOnce(new Error("boom"));
    await expect(acquirePhoto("panoramas/gd1/fail.jpg")).rejects.toThrow("boom");
    const ok = await acquirePhoto("panoramas/gd1/fail.jpg");
    expect(ok.url).toMatch(/^blob:/);
    ok.release();
  });

  it("invalidate drops it from the cache, revoking once nobody holds it", async () => {
    const held = await acquirePhoto("panoramas/gd1/inv.jpg");
    invalidatePhoto("panoramas/gd1/inv.jpg");
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    held.release();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    const fresh = await acquirePhoto("panoramas/gd1/inv.jpg");
    expect(apiGetBlob).toHaveBeenCalledTimes(2);
    fresh.release();
  });
});

describe("fetchPhotoBlob", () => {
  it("reads a protected photo through the authenticated endpoint", async () => {
    const blob = new Blob(["p"]);
    apiGetBlob.mockResolvedValue(blob);
    expect(await fetchPhotoBlob("roomphoto/gd1/r.webp")).toBe(blob);
    expect(apiGetBlob.mock.calls[0][0]).toBe("IndoorUploads_API/serve?path=roomphoto%2Fgd1%2Fr.webp");
  });

  it("reads a public photo straight from its static URL, skipping the cache", async () => {
    const blob = new Blob(["t"]);
    const fetchMock = vi.fn(async () => ({ ok: true, blob: async () => blob }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchPhotoBlob("tourcover/a.webp")).toBe(blob);
    expect(fetchMock).toHaveBeenCalledWith("http://host/api/uploads/tourcover/a.webp", { cache: "no-cache" });
  });

  it("fails clearly when a public photo can't be read, or the path is unknown", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
    await expect(fetchPhotoBlob("tourcover/a.webp")).rejects.toThrow("Couldn't load the existing photo.");
    await expect(fetchPhotoBlob("old-firebase-path.jpg")).rejects.toThrow("old storage path");
  });
});

describe("reuploadPhoto", () => {
  it("saves back under the same category, building and name (per-building photo)", async () => {
    apiUpload.mockResolvedValue({ path: "room360/gd1/r.webp" });
    const result = await reuploadPhoto("room360/gd1/r.webp", new Blob(["x"]));
    const [endpoint, formData] = apiUpload.mock.calls[0];
    expect(endpoint).toBe("IndoorUploads_API/room360Photo");
    expect(formData.get("building")).toBe("gd1");
    expect(formData.get("filename")).toBe("r.webp");
    expect(result).toEqual({ path: "room360/gd1/r.webp" });
  });

  it("sends no building for a flat (public tour) photo", async () => {
    apiUpload.mockResolvedValue({ path: "tourpanorama/s.webp" });
    await reuploadPhoto("tourpanorama/s.webp", new Blob(["x"]));
    const [endpoint, formData] = apiUpload.mock.calls[0];
    expect(endpoint).toBe("TourUploads_API/panorama");
    expect(formData.get("building")).toBeNull();
  });

  it("reports a different path when the format changed", async () => {
    apiUpload.mockResolvedValue({ path: "roomphoto/gd1/r.webp" });
    expect(await reuploadPhoto("roomphoto/gd1/r.jpg", new Blob(["x"]))).toEqual({ path: "roomphoto/gd1/r.webp" });
  });
});
