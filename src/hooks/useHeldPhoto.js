import { useEffect, useState } from "react";
import { acquirePhoto } from "../utils/photoStore";
import { useSecurePhotoUrl } from "./useSecurePhotoUrl";

// Like useSecurePhotoUrl (session-cached), but keeps returning the last photo
// that finished loading while the next one resolves, so a viewer can leave
// the old picture on screen, at its own size, instead of collapsing to a
// loading box. `path` is the one on screen. `pending` is true while `path` is not the one being shown.
export function useHeldPhoto(path) {
  const { url, error } = useSecurePhotoUrl(path, { cached: true });
  const [held, setHeld] = useState(null);
  if (url && (held?.path !== path || held.url !== url)) setHeld({ path, url });
  return { url: held?.url ?? null, path: held?.path ?? null, pending: held?.path !== path, error };
}

// Holds every one of a room's photos in photoStore's session cache for as
// long as the room is open, so moving between them needs no fetch and the
// cache can't evict one of them from under a viewer that is showing it.
export function usePreloadPhotos(photos) {
  const joined = photos.join("|");
  useEffect(() => {
    let cancelled = false;
    const releases = [];
    for (const path of joined ? joined.split("|") : []) {
      acquirePhoto(path).then(
        (loaded) => {
          if (cancelled) loaded.release();
          else releases.push(loaded.release);
        },
        () => {} // a failed warm-up just means the real load happens on demand
      );
    }
    return () => {
      cancelled = true;
      releases.forEach((release) => release());
    };
  }, [joined]);
}
