import { useEffect, useMemo } from "react";
import { acquireThumbnail } from "../utils/photoStore";
import { planDirectoryPreload } from "../utils/directoryPreload";
import { preloadRectilinear } from "./useRectilinearPreview";
import { CELL_PREVIEW, PANORAMA_THUMBNAIL_WIDTH } from "./useFlatPhotoUrl";
import { cellView, isPanorama } from "../utils/roomPhotos";

// Each building's top cells are warmed straight away, two at a time; the rest
// follow one at a time with a pause between, so a directory of hundreds of
// rooms trickles in without crowding out what the visitor is actually doing.
const FIRST_PER_BUILDING = 4;
const FIRST_CONCURRENCY = 2;
const REST_PAUSE_MS = 400;

async function warm(photo) {
  try {
    const panorama = isPanorama(photo);
    const { url } = await acquireThumbnail(photo.path, panorama ? PANORAMA_THUMBNAIL_WIDTH : undefined);
    // A 360 cell shows a projection of the photo, which is the slow part.
    const view = cellView(photo);
    if (panorama) await preloadRectilinear(url, view.yaw, CELL_PREVIEW, view.pitch, view.fov);
  } catch {
    // The row loads it itself when it scrolls into view.
  }
}

// Warms the Directory's cell photos into photoStore's thumbnail cache (and
// the projection cache for 360 photos), so rows show their photo the moment
// they appear instead of loading when scrolled to.
export function useDirectoryThumbnailPreload(rooms, buildings, settings) {
  const plan = useMemo(
    () => planDirectoryPreload(rooms, buildings, settings, FIRST_PER_BUILDING),
    [rooms, buildings, settings]
  );

  useEffect(() => {
    let cancelled = false;
    let timer = null;

    const runFirst = async () => {
      const queue = [...plan.first];
      const worker = async () => {
        while (!cancelled && queue.length) await warm(queue.shift());
      };
      await Promise.all(Array.from({ length: FIRST_CONCURRENCY }, worker));
    };

    const runRest = (i = 0) => {
      if (cancelled || i >= plan.rest.length) return;
      warm(plan.rest[i]).then(() => {
        if (!cancelled) timer = setTimeout(() => runRest(i + 1), REST_PAUSE_MS);
      });
    };

    runFirst().then(() => runRest());
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [plan]);
}
