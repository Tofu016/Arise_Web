import { markersForRoom } from "./search";
import { newMarkerId } from "./placement";

// The marker list a node should end up with when a room or facility is
// saved from the Room and Facility Editor, or null when nothing changes (so
// no marker call is made).
//
//   kind       "room" | "facility"
//   oldName    the name its markers are saved under now (null when new)
//   newName    the name they should read after the save
//   placement  { yaw, pitch } picked in the editor, or null: moves the first
//              of its markers there, or adds one when it has none
//   remove     true when the room is leaving this node: its markers go too
export function markersAfterSave(node, { kind, oldName = null, newName = oldName, placement = null, remove = false }) {
  const markers = node.markers || [];
  const mine = oldName ? markersForRoom(node, kind, oldName) : [];
  if (remove) return mine.length ? markers.filter((m) => !mine.includes(m)) : null;

  if (mine.length === 0) {
    if (!placement) return null;
    return [...markers, { id: newMarkerId(), type: kind, label: newName, ...placement }];
  }

  let changed = false;
  const next = markers.map((m) => {
    if (!mine.includes(m)) return m;
    const moved = m === mine[0] && placement ? placement : null;
    if (m.label === newName && !moved) return m;
    changed = true;
    return { ...m, label: newName, ...(moved || {}) };
  });
  return changed ? next : null;
}
