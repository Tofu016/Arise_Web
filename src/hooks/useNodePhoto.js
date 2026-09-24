import { useEffect, useState } from "react";
import { useSecurePhotoUrl } from "./useSecurePhotoUrl";
import { useImagePreloaded } from "./useImagePreloaded";
import { useRectilinearPreview } from "./useRectilinearPreview";
import { prefetchPhoto } from "../utils/photoStore";
import { planPrefetch, nextFirstLoadDone } from "../utils/photoPipeline";

// The visitor's photo pipeline. photoStore is the seam beneath it; callers
// see only what to show and when it is safe to show it.

// The photo of the node the visitor is standing on.
//   url            the displayable URL ("" until resolved, or if there is none)
//   ready          its bytes are decoded and paintable (true when the node has
//                  no photo, or it failed to load, so nothing waits forever)
//   firstLoadDone  latches true the first time nodes are in and `ready` — for
//                  the one-time splash; later moves never bring it back
// Once ready, quietly warms the photos its hotspots lead to, one at a time
// (never crowding out a photo the visitor tapped), `priorityId` first — see
// planPrefetch. Call it before any early return; it is a hook.
export function useNodePhoto(node, { neighbors = [], priorityId, nodesLoaded = true } = {}) {
  const { url, error } = useSecurePhotoUrl(node?.photo, { cached: true });
  const decoded = useImagePreloaded(url);
  // `error` covers the fetch itself failing (missing file, auth/network
  // error) — without it, `url` stays null and `decoded` (which needs a url
  // to even start) never resolves, leaving the visitor stuck on the loading
  // screen forever instead of landing on the "no image" state.
  const ready = !node?.photo || decoded || !!error;

  // Latched during render (React's derive-state-from-props pattern), so the
  // splash never gets an extra frame after the photo is ready.
  const [latched, setLatched] = useState(false);
  const firstLoadDone = nextFirstLoadDone(latched, { nodesLoaded, photoReady: ready });
  if (firstLoadDone !== latched) setLatched(firstLoadDone);

  const prefetchKey = decoded ? planPrefetch(neighbors, { currentId: node?.id, priorityId }).join("|") : "";
  useEffect(() => {
    if (!prefetchKey) return;
    let cancelled = false;
    (async () => {
      for (const photo of prefetchKey.split("|")) {
        if (cancelled) return;
        await prefetchPhoto(photo);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [prefetchKey]);

  return { url: url || "", ready, firstLoadDone };
}

// A hotspot's sneak-peek: a normal-looking (rectilinear) view of `photo`
// looking along `yaw`, or null while it is being made. Fetches nothing until
// `active`. Falls back to the raw 360° photo only once the projection has
// actually failed — never while it is still working, or the flat map flashes.
export function useHotspotPreview(photo, yaw, active) {
  const { url } = useSecurePhotoUrl(active ? photo : null, { cached: true });
  const { url: projected, failed } = useRectilinearPreview(url, yaw);
  return projected || (failed ? url : null);
}
