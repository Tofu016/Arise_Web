import { useCallback, useRef, useState } from "react";
import FaceReviewPanel from "../components/FaceReviewPanel";
import { convertImage } from "../utils/imageConverter";
import { fetchPhotoBlob, reuploadPhoto } from "../utils/photoStore";

// Puts the manual blur review in front of an image upload. Nothing is sent to
// the server until the admin has looked at the photo and confirmed, so an
// unblurred face never reaches storage.
//
//   const { requestBlur, blurDialog } = useBlurReview();
//   const reviewed = await requestBlur(file);   // Blob, or null if cancelled
//   if (!reviewed) return;
//   await uploadPhoto(kind, reviewed, { ... });
//   ...
//   const saved = await reblurStored(path);    // edit a stored photo: { path } | null
//   return (<>{...}{blurDialog}</>);            // render the dialog somewhere
//
// Node panoramas have their own server-side holding-area flow
// (utils/panoramaReview.js); this is the simpler "review, then upload" one
// used by every other image upload.
export function useBlurReview() {
  const [pending, setPending] = useState(null); // { imageBlob, resolve }
  const busy = useRef(false); // an "edit stored photo" is in flight — ignore double clicks

  const requestBlur = useCallback(async (file) => {
    // Same normalisation the upload would do anyway, and it makes formats a
    // browser can't draw (e.g. HEIC) fail here, before the dialog opens.
    const imageBlob = await convertImage(file);
    return new Promise((resolve) => setPending({ imageBlob, resolve }));
  }, []);

  // Re-opens a photo that's already stored: loads it, lets the admin mark
  // more regions, then saves the result over it. Resolves { path } (usually
  // the same path — see reuploadPhoto), or null if cancelled. Rejects if the
  // photo can't be loaded or saved.
  const reblurStored = useCallback(async (path) => {
    if (busy.current) return null;
    busy.current = true;
    try {
      const imageBlob = await fetchPhotoBlob(path);
      const reviewed = await new Promise((resolve) => setPending({ imageBlob, resolve }));
      return reviewed ? await reuploadPhoto(path, reviewed) : null;
    } finally {
      busy.current = false;
    }
  }, []);

  const settle = (result) => {
    pending?.resolve(result);
    setPending(null);
  };

  const blurDialog = pending ? (
    <FaceReviewPanel
      imageBlob={pending.imageBlob}
      onConfirm={(blob) => settle(blob)}
      onCancel={() => settle(null)}
    />
  ) : null;

  return { requestBlur, reblurStored, blurDialog };
}
