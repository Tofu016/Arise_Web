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
