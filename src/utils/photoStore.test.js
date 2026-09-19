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
import { photoFilename, uploadPhoto, loadPhoto } from "./photoStore";

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
