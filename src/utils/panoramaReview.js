import { apiPost, apiUpload } from "./apiClient";
import { convertImage } from "./imageConverter";
import { fetchProtectedPhoto, uploadPhoto } from "./photoStore";

// The blur-review lifecycle for a node panorama. A photo is never
// reachable through the normal viewing path until an admin confirms it,
// so a brand-new upload sits in a temporary, admin-only holding area
// until then. Two ways in, one way out:
//
//   startReview(file, ...)     brand-new upload → temp copy + review
//   reviewExisting(path)       reopen a published photo → review, no temp
//   confirmReview(review, ...) publish the blurred result, clean up
//   cancelReview(review)       throw the temp copy away
//
// A review is { imageBlob, storagePath, targetFilename, tempPath }.
// tempPath is set only for a brand-new upload; reopening an existing
// photo reuses its real path and has no temp file.

export async function startReview(file, { building, filename }) {
  const converted = await convertImage(file);

  const formData = new FormData();
  formData.append("file", converted);
  formData.append("building", building);
  formData.append("filename", filename);
  const data = await apiUpload("IndoorUploads_API/panoramaReview", formData);

  return { imageBlob: converted, storagePath: data.path, targetFilename: filename, tempPath: data.path };
}

export async function reviewExisting(path) {
  const imageBlob = await fetchProtectedPhoto(path, "Couldn't load the existing photo.");
  return { imageBlob, storagePath: path, targetFilename: null, tempPath: null };
}

// Publishes the reviewed/blurred version under its real, permanent name
// (a new upload) or overwrites the published file in place (reopened
// photo), then removes the temp copy. Returns { path, isNew } — `isNew`
// is true when the photo has a new storage path the record must adopt;
// an in-place overwrite keeps the same path, so an already-open preview
// elsewhere may need a reload to pick up the new bytes.
export async function confirmReview(review, blurredBlob, { building }) {
  const { tempPath, targetFilename, storagePath } = review;
  const filename = tempPath ? targetFilename : storagePath.split("/").pop();

  const { path } = await uploadPhoto("panorama", blurredBlob, { building, filename });
  if (tempPath) await discardTemp(tempPath);
  return { path, isNew: Boolean(tempPath) };
}

export async function cancelReview(review) {
  if (review?.tempPath) await discardTemp(review.tempPath);
}

// Best-effort — a leftover temp file is a minor storage cost, not worth
// failing the whole flow over a transient delete error.
async function discardTemp(path) {
  try {
    await apiPost("IndoorUploads_API/deleteReviewFile", { path });
  } catch {
    // ignore
  }
}
