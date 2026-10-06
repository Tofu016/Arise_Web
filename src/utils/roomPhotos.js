// A room's photos in the order an admin sorted them in Room Editor, each
// { path, kind: "flat" | "360", x, y }. x/y are a flat photo's square
// thumbnail focus (CSS object-position percentages); a 360 photo has none,
// its thumbnail is the flattened view (see useRectilinearPreview). The first
// photo is the room's thumbnail in the directory.
export function roomPhotos(placard) {
  return placard?.photos || [];
}

export const isPanorama = (photo) => photo?.kind === "360";

// The list with the item at `from` moved to `to`, the rest keeping their order.
export function moveItem(list, from, to) {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// The CSS object-position for a thumbnail focus (centered when unset).
export function focusPosition(focus) {
  return `${focus?.x ?? 50}% ${focus?.y ?? 50}%`;
}

// The shape of a 360 photo's view as the admin's picker frames it (width in
// degrees, and height / width of the picture): the viewer's opening frame, and the flattened thumbnail (80
// across, the same as the stills it makes).
export const DEFAULT_VIEW_FRAME = { fov: 90, aspect: 0.6 };

// How wide, in degrees, a 360 photo's flattened thumbnail looks. Tighter than
// the minimum shows blurry (the photo is fetched downscaled), wider than the
// maximum stretches the corners too far.
export const THUMBNAIL_FOV = { min: 60, max: 110, default: 80 };

// The directory cell's zoom has no practical limit: 170 is as wide as the
// projection can go (it can't reach 180).
export const CELL_FOV = { min: 10, max: 170, default: 80 };

// Where a 360 photo's flattened still looks, { yaw, pitch, fov } in degrees:
// the square thumbnail (room panel, photo strip) and, separately, the wide one
// in the directory cell.
export const thumbnailView = (photo) => ({ yaw: photo?.thumbYaw ?? 0, pitch: photo?.thumbPitch ?? 0, fov: photo?.thumbFov ?? THUMBNAIL_FOV.default });
export const cellView = (photo) => ({ yaw: photo?.cellYaw ?? 0, pitch: photo?.cellPitch ?? 0, fov: photo?.cellFov ?? THUMBNAIL_FOV.default });
