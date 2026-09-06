// Resizes a picked image file down to a maximum width before it's uploaded
// anywhere — panorama photos straight from a 360° camera are typically much
// larger than any client actually needs to display, and the extra pixels
// directly translate into slower decode time on mobile (which decodes
// images in pure JS, with no native fast-path — see the mobile app's
// useSecurePhotoPixels hook for why that trade-off was made). Resizing once
// here, at the source, benefits every client: faster mobile decode, faster
// web/desktop loads, lower Storage costs.
//
// 1536px chosen as a balance — since the panorama is viewed through a ~75°
// window onto the full 360° sphere, you're only ever seeing a fraction of
// the image's horizontal pixels at once, so some resolution reduction is
// more forgiving here than on a flat photo. Going lower (e.g. 1024px) saves
// more decode time but starts looking noticeably softer, especially for any
// readable text/signage in a photo.
export function resizeImageIfNeeded(file, maxWidth = 1536) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Already small enough — skip re-encoding entirely, no quality loss
      // for an image that didn't need resizing in the first place.
      if (img.width <= maxWidth) {
        resolve(file);
        return;
      }

      const scale = maxWidth / img.width;
      const targetWidth = maxWidth;
      const targetHeight = Math.round(img.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Couldn't resize the image."));
            return;
          }
          resolve(blob);
        },
        "image/jpeg",
        0.9
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't load the image to resize it."));
    };

    img.src = url;
  });
}
