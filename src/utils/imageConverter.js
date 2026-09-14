// Converts a picked image file to a standard, guaranteed-accepted format
// before it's uploaded anywhere — no resizing at all. Replaces
// imageResize.js's resizeImageIfNeeded, which also downscaled oversized
// panoramas; that performance benefit (faster mobile decode on an
// oversized photo) is genuinely gone with this change, a deliberate
// trade-off, not an oversight.
//
// Exists because the backend's own upload validation
// (IndoorUploads_API/TourUploads_API's validateAndGetExtension) only
// accepts jpg/png/gif/webp — a HEIC photo straight off an iPhone camera,
// for instance, would otherwise be rejected outright, since HEIC isn't
// in that accepted set at all.
//
// Defaults to WebP, not JPEG — smaller files at equivalent visual
// quality, and the backend already accepted it (webp was already in
// validateAndGetExtension's own accepted list from the start). WEB ONLY,
// deliberately: the mobile app's PanoramaViewer decodes panorama bytes
// via jpeg-js specifically, a JPEG-only decoder (see useSecurePhotoPixels
// in the mobile codebase) — a WebP file would fail to decode there
// entirely. This is safe only because mobile is still fully separate,
// still on Firebase; this needs revisiting before mobile ever connects
// to this same upload pipeline.
export function convertImage(file, outputType = "image/webp", quality = 0.9) {
  return new Promise((resolve, reject) => {
    // Already the target format — skip re-encoding entirely. Re-encoding
    // a file that's already the right type would be a wasted, lossy step
    // for no benefit, the same reasoning the original resize function
    // used for "already small enough."
    if (file.type === outputType) {
      resolve(file);
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Couldn't convert the image."));
            return;
          }
          resolve(blob);
        },
        outputType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't load the image to convert it."));
    };

    img.src = url;
  });
}
