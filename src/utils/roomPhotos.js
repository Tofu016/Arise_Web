// A room's photos in display order: the main photo first, then the extras an
// admin added in Room Editor (each { path, x, y }). `placard.photos` wins when
// present so a record that already carries the full list is used as-is.
export function roomPhotos(placard) {
  if (placard?.photos?.length) return placard.photos;
  const list = [];
  if (placard?.photo) list.push(placard.photo);
  for (const extra of placard?.extraPhotos || []) {
    if (extra?.path && !list.includes(extra.path)) list.push(extra.path);
  }
  return list;
}

// path -> { x, y }: where each photo's square thumbnail is centered, as CSS
// object-position percentages. A photo with no entry is centered.
export function roomPhotoFocus(placard) {
  const focus = {};
  for (const extra of placard?.extraPhotos || []) focus[extra.path] = { x: extra.x, y: extra.y };
  // The main photo's own setting wins if an extra repeats its path.
  if (placard?.photo) focus[placard.photo] = placard.photoFocus || { x: 50, y: 50 };
  return focus;
}

// The CSS object-position for a thumbnail focus (centered when unset).
export function focusPosition(focus) {
  return `${focus?.x ?? 50}% ${focus?.y ?? 50}%`;
}
