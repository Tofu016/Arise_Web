import { useRectilinearPreview } from "./useRectilinearPreview";
import { isPanorama, thumbnailView } from "../utils/roomPhotos";

// Output sizes of the flat-looking view of a 360 photo, per place it is shown.
export const SQUARE_PREVIEW = { width: 480, height: 480 }; // room panel carousel
// Room panel carousel on the Mobile web layout, for a 360 photo only: 4:5, a
// little taller than square, since a phone has height to spare and a flat
// view out of a 360 shows more of the room the taller it is.
export const TALL_PREVIEW = { width: 480, height: 600 };
// Directory cell: the shape of a one-line row at the sidebar's 340px (340 by
// 60), doubled for sharpness, so what it shows is what the row shows.
export const CELL_PREVIEW = { width: 680, height: 120 };
// A 360 photo's thumbnail is asked for at this width (one of the backend's
// Photo_preview::WIDTHS), since only a crop of it is shown.
export const PANORAMA_THUMBNAIL_WIDTH = 1024;
export const STRIP_PREVIEW = { width: 128, height: 96 }; // photo viewer's strip

// What a room photo shows as a still: a flat photo as-is, a 360 photo
// as a normal-looking view out of it, centered on the angles an admin chose (like a node's hotspot sneak-peek), so
// the equirectangular map never shows. `view` is where it looks (the square
// thumbnail's by default). `url` is the photo's loaded URL. null
// while the projection is still working, falling back to the raw photo only
// if it fails.
export function useFlatPhotoUrl(url, photo, size, view = thumbnailView(photo)) {
  const panorama = isPanorama(photo);
  const { url: projected, failed } = useRectilinearPreview(panorama ? url : null, view.yaw, size, view.pitch, view.fov);
  if (!panorama) return url;
  return projected || (failed ? url : null);
}
