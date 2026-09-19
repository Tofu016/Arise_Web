import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./apiClient", () => ({ apiPost: vi.fn(), apiUpload: vi.fn() }));
vi.mock("./imageConverter", () => ({ convertImage: vi.fn(async (f) => f) }));
vi.mock("./photoStore", () => ({ uploadPhoto: vi.fn(), fetchProtectedPhoto: vi.fn() }));

import { apiPost, apiUpload } from "./apiClient";
import { uploadPhoto, fetchProtectedPhoto } from "./photoStore";
import { startReview, reviewExisting, confirmReview, cancelReview } from "./panoramaReview";

beforeEach(() => vi.clearAllMocks());

describe("startReview", () => {
  it("uploads a temp copy and returns a review with a tempPath", async () => {
    apiUpload.mockResolvedValue({ path: "review/tmp.webp" });
    const file = new Blob(["x"]);

    const review = await startReview(file, { building: "gd1", filename: "n1.jpg" });

    const [endpoint, formData] = apiUpload.mock.calls[0];
    expect(endpoint).toBe("IndoorUploads_API/panoramaReview");
    expect(formData.get("building")).toBe("gd1");
    expect(formData.get("filename")).toBe("n1.jpg");
    expect(review).toEqual({
      imageBlob: file,
      storagePath: "review/tmp.webp",
      targetFilename: "n1.jpg",
      tempPath: "review/tmp.webp",
    });
  });
});

describe("reviewExisting", () => {
  it("reads the published photo and sets no tempPath", async () => {
    const blob = new Blob(["x"]);
    fetchProtectedPhoto.mockResolvedValue(blob);
    expect(await reviewExisting("panoramas/gd1/n1.jpg")).toEqual({
      imageBlob: blob,
      storagePath: "panoramas/gd1/n1.jpg",
      targetFilename: null,
      tempPath: null,
    });
  });
});

describe("confirmReview", () => {
  it("publishes a new upload under its target name, then deletes the temp copy", async () => {
    uploadPhoto.mockResolvedValue({ path: "panoramas/gd1/n1.jpg" });
    apiPost.mockResolvedValue({});
    const blurred = new Blob(["b"]);

    const result = await confirmReview(
      { tempPath: "review/tmp", targetFilename: "n1.jpg", storagePath: "review/tmp" },
      blurred,
      { building: "gd1" }
    );

    expect(uploadPhoto).toHaveBeenCalledWith("panorama", blurred, { building: "gd1", filename: "n1.jpg" });
    expect(apiPost).toHaveBeenCalledWith("IndoorUploads_API/deleteReviewFile", { path: "review/tmp" });
    expect(result).toEqual({ path: "panoramas/gd1/n1.jpg", isNew: true });
  });

  it("overwrites a reopened photo in place and deletes nothing", async () => {
    uploadPhoto.mockResolvedValue({ path: "panoramas/gd1/n1.jpg" });

    const result = await confirmReview(
      { tempPath: null, targetFilename: null, storagePath: "panoramas/gd1/n1.jpg" },
      new Blob(["b"]),
      { building: "gd1" }
    );

    expect(uploadPhoto.mock.calls[0][2].filename).toBe("n1.jpg");
    expect(apiPost).not.toHaveBeenCalled();
    expect(result.isNew).toBe(false);
  });

  it("still succeeds when temp cleanup fails", async () => {
    uploadPhoto.mockResolvedValue({ path: "panoramas/gd1/n1.jpg" });
    apiPost.mockRejectedValue(new Error("boom"));

    await expect(
      confirmReview({ tempPath: "t", targetFilename: "n1.jpg", storagePath: "t" }, new Blob(["b"]), { building: "gd1" })
    ).resolves.toMatchObject({ isNew: true });
  });
});

describe("cancelReview", () => {
  it("deletes the temp copy of a new upload", async () => {
    apiPost.mockResolvedValue({});
    await cancelReview({ tempPath: "review/tmp" });
    expect(apiPost).toHaveBeenCalledWith("IndoorUploads_API/deleteReviewFile", { path: "review/tmp" });
  });

  it("does nothing for a reopened photo or no review", async () => {
    await cancelReview({ tempPath: null });
    await cancelReview(null);
    expect(apiPost).not.toHaveBeenCalled();
  });
});
