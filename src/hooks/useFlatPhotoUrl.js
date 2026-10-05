import { useRectilinearPreview } from "./useRectilinearPreview";
import { isPanorama } from "../utils/roomPhotos";

// Output sizes of the flat-looking view of a 360 photo, per place it is shown.
export const SQUARE_PREVIEW = { width: 480, height: 480 }; // room panel carousel
export const CELL_PREVIEW = { width: 320, height: 120 }; // directory cell
// A 360 photo's thumbnail is asked for at this width (one of the backend's
// Photo_preview::WIDTHS), since only a crop of it is shown.
export const PANORAMA_THUMBNAIL_WIDTH = 1024;
export const STRIP_PREVIEW = { width: 128, height: 96 }; // photo viewer's strip

// What a room photo shows as a still: a flat photo as-is, a 360 photo
// as a normal-looking view out of it (like a node's hotspot sneak-peek), so
// the equirectangular map never shows. `url` is the photo's loaded URL. null
// while the projection is still working, falling back to the raw photo only
// if it fails.
export function useFlatPhotoUrl(url, photo, size) {
  const panorama = isPanorama(photo);
  const { url: projected, failed } = useRectilinearPreview(panorama ? url : null, 0, size);
  if (!panorama) return url;
  return projected || (failed ? url : null);
}
