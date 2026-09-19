import { useEffect, useState } from "react";
import { loadPhoto } from "../utils/photoStore";

// React adapter over photoStore's loadPhoto: `photo` is a backend storage
// path, e.g. "panoramas/gd1/gd1_f2_hallway01.jpg". Public tour paths
// resolve to a direct URL; protected indoor paths are fetched with the
// current auth token into a blob: URL, revoked on change or unmount.
export function useSecurePhotoUrl(photo) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setUrl(null);
    setError(null);
    if (!photo) return;

    let cancelled = false;
    let release = null;

    loadPhoto(photo)
      .then((loaded) => {
        if (cancelled) {
          loaded.release();
          return;
        }
        release = loaded.release;
        setUrl(loaded.url);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
      if (release) release();
    };
  }, [photo]);

  return { url, error };
}
