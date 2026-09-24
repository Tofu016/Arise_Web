import { useEffect, useState } from "react";
import { acquirePhoto, loadPhoto } from "../utils/photoStore";

// React adapter over photoStore's loadPhoto: `photo` is a backend storage
// path, e.g. "panoramas/gd1/gd1_f2_hallway01.jpg". Public tour paths
// resolve to a direct URL; protected indoor paths are fetched with the
// current auth token into a blob: URL, revoked on change or unmount.
// `cached` serves it from photoStore's session cache instead (shared with
// prefetchPhoto) — for the visitor view; admin editors leave it off so an
// edited photo is never shown stale.
//
// `version` is for a photo edited in place (same path, new bytes): bump it to
// reload, and public photos get a cache-busting query so the browser doesn't
// keep showing the old file.
export function useSecurePhotoUrl(photo, { cached = false, version = 0 } = {}) {
  // Keyed on the (photo, cached, version) it was resolved for, and reset
  // during render (not only in the effect below) the instant that key
  // changes. An effect-based reset alone only runs AFTER the render where
  // `photo` already moved on to a new node — for that one render tick this
  // would otherwise still return the PREVIOUS node's resolved url, paired
  // with a caller's already-updated sceneKey for the new node. PanoramaNav
  // takes that pairing as "the new scene has finished loading" and reveals
  // it — the previous node's photo flashes as if it belonged to the node
  // just navigated to. See useImagePreloaded's identical pattern.
  const key = `${photo ?? ""}|${cached}|${version}`;
  const [state, setState] = useState({ key, url: null, error: null });
  if (state.key !== key) setState({ key, url: null, error: null });

  useEffect(() => {
    if (!photo) return;

    let cancelled = false;
    let release = null;

    (cached ? acquirePhoto : loadPhoto)(photo)
      .then((loaded) => {
        if (cancelled) {
          loaded.release();
          return;
        }
        release = loaded.release;
        const url = version && !loaded.url.startsWith("blob:") ? `${loaded.url}?v=${version}` : loaded.url;
        setState({ key, url, error: null });
      })
      .catch((err) => {
        if (!cancelled) setState({ key, url: null, error: err.message });
      });

    return () => {
      cancelled = true;
      if (release) release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo, cached, version]);

  return state.key === key ? { url: state.url, error: state.error } : { url: null, error: null };
}
