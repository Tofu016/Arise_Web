import { useEffect, useState } from "react";

// Reports whether a given image URL has actually finished loading — not
// just "the URL resolved" (e.g. useSecurePhotoUrl's blob: URL is already
// in memory the moment it's returned, but the browser still needs to
// decode those bytes into paintable pixels). Uses a plain Image() object
// rather than reaching into PanoramaNav's own WebGL texture-loading
// internals — this stays fully decoupled from how the panorama itself is
// actually rendered, at the cost of not being a perfect guarantee that
// the GPU texture upload has finished too (a separate, near-instant step
// after decode) — good enough for a loading screen's purposes without
// coupling this hook to PanoramaNav's internals.
//
// Resolves `true` on error too, deliberately — a broken/missing photo
// shouldn't leave a visitor stuck on the loading screen forever; better
// to let the page reveal itself and show its own "no photo" state than
// hang indefinitely waiting for an image that will never load.
export function useImagePreloaded(url) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!url) {
      setLoaded(false);
      return;
    }
    setLoaded(false);
    const img = new Image();
    img.onload = () => setLoaded(true);
    img.onerror = () => setLoaded(true);
    img.src = url;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [url]);

  return loaded;
}
