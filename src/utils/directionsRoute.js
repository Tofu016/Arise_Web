import { findPath, getTurnInstruction } from "./pathfinding";
import { resolveExactNodeMatch } from "./search";

// Point-to-point directions, as plain state plus transitions — no React,
// no timers. `null` means no directions are open.
//
// State: { fromQuery, fromId, toQuery, toId, path, stepIndex, error,
//          editingField, kind, autoWalking }
//   kind         "point" (always — the visitor picks the destination)
//   autoWalking  stepping through `path` hands-free; lives here so it can
//                never outlive the route it walks
//
// Every function returns the next state and returns the same object when
// nothing changed, so a caller can skip a re-render by identity.

function blank(current, kind) {
  return {
    fromQuery: current?.name || "",
    fromId: current?.id || null,
    toQuery: "",
    toId: null,
    path: null,
    stepIndex: 0,
    error: "",
    editingField: null,
    kind,
    autoWalking: false,
  };
}

export function openDirectionsTo(current, node) {
  return { ...blank(current, "point"), toQuery: node.name, toId: node.id };
}

// Opens an empty directions panel starting from where the visitor is; the
// destination is picked (or typed) in the panel.
export function openDirections(current) {
  return blank(current, "point");
}

const queryKey = (field) => (field === "from" ? "fromQuery" : "toQuery");
const idKey = (field) => (field === "from" ? "fromId" : "toId");

// Typing into a From/To field: the typed text no longer resolves to a
// node, and any computed path is stale.
export function editField(d, field, value) {
  return { ...d, [queryKey(field)]: value, [idKey(field)]: null, editingField: field, path: null, error: "" };
}

export function focusField(d, field) {
  return { ...d, editingField: field };
}

export function pickNodeField(d, field, node) {
  return { ...d, [queryKey(field)]: node.name, [idKey(field)]: node.id, editingField: null };
}

// A ROOM result: the navigable target is still the room's own node
// (pathfinding operates over nodes), but the field shows the room's name,
// since that's what was searched for and picked.
export function pickRoomField(d, field, room) {
  return { ...d, [queryKey(field)]: room.roomName, [idKey(field)]: room.node.id, editingField: null };
}

// The text of whichever From/To field is being edited, for suggestions.
export function activeQuery(d) {
  if (d?.editingField === "from") return d.fromQuery;
  if (d?.editingField === "to") return d.toQuery;
  return "";
}

// "Get directions": resolves typed text to nodes by exact name (so it works
// without clicking a suggestion), then computes the route. The resolved
// ids are persisted, not just the path — starting the walk reads the
// path's first stop.
export function getDirections(d, nodes, searchableRooms) {
  let fromId = d.fromId;
  let toId = d.toId;
  if (!fromId && d.fromQuery) fromId = resolveExactNodeMatch(d.fromQuery, nodes, searchableRooms)?.id ?? fromId;
  if (!toId && d.toQuery) toId = resolveExactNodeMatch(d.toQuery, nodes, searchableRooms)?.id ?? toId;

  if (!fromId || !toId) {
    return { ...d, error: "Pick both a starting point and a destination from the suggestions, or type the exact name." };
  }
  const path = findPath(nodes, fromId, toId);
  if (!path) return { ...d, path: null, error: "No walkable route found between these two points yet." };
  return { ...d, fromId, toId, path, stepIndex: 0, error: "" };
}

export function restartRoute(d) {
  return { ...d, stepIndex: 0 };
}

// Keep the route in sync with where the visitor actually is: following the
// highlighted hotspot just advances the step; wandering off re-routes from
// the new spot instead of leaving a stale path on screen.
export function syncToPosition(d, currentId, nodes) {
  if (!d?.path || !currentId) return d;
  const idx = d.path.indexOf(currentId);
  if (idx !== -1) return idx === d.stepIndex ? d : { ...d, stepIndex: idx };

  const reroute = findPath(nodes, currentId, d.toId);
  if (!reroute) {
    return { ...d, path: null, stepIndex: 0, error: "Lost the route from here — try Get directions again." };
  }
  return { ...d, path: reroute, stepIndex: 0, error: "" };
}

// The next stop and which way to face going through it, or null at the end.
// `hotspots` are the hotspots of the node the visitor is standing at.
export function nextStep(d, hotspots) {
  const id = d?.path?.[d.stepIndex + 1];
  if (!id) return null;
  const hs = hotspots.find((h) => h.id === id);
  return { id, yaw: hs?.yaw, defaultYaw: hs?.defaultYaw, defaultPitch: hs?.defaultPitch };
}

export function toggleAutoWalk(d) {
  return { ...d, autoWalking: !d.autoWalking };
}

// Auto-walk stops itself rather than leaving a stale timer: when the route
// is gone, or the destination is reached.
export function settleAutoWalk(d) {
  if (!d?.autoWalking) return d;
  if (!d.path || d.stepIndex === d.path.length - 1) return { ...d, autoWalking: false };
  return d;
}

// Everything the panel shows about progress along the route.
// `turnInstruction` only means something past the first stop — before that
// there's no real prior direction to turn relative to (entryYaw is the way
// you arrived, set from the hotspot you walked through).
export function routeProgress(d, { byId, hotspots, entryYaw }) {
  const arrived = Boolean(d?.path && d.stepIndex === d.path.length - 1);
  const nextStopId = d?.path?.[d.stepIndex + 1] || null;
  const nextStopName = nextStopId ? byId[nextStopId]?.name || nextStopId : null;
  const nextStopHotspot = nextStopId ? hotspots.find((h) => h.id === nextStopId) || null : null;
  const turnInstruction =
    d?.stepIndex > 0 && nextStopHotspot ? getTurnInstruction(entryYaw, nextStopHotspot.yaw) : null;
  return { arrived, nextStopId, nextStopName, nextStopHotspot, turnInstruction };
}

// Whether the visitor has actually begun walking the route: it exists, and
// they are standing on its first stop (or already past it). Before that the
// panel offers "Start walking" instead.
export function hasStartedWalking(d, currentId) {
  return !!d?.path && !(d.stepIndex === 0 && currentId !== d.path[0]);
}
