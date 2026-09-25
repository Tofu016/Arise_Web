import { findPath, getTurnInstruction } from "./pathfinding";
import { resolveExactNodeMatch } from "./search";
import { elevatorRideBetween, arrivalYawFromLanding } from "./elevators";

// Point-to-point directions, as plain state plus transitions — no React,
// no timers. `null` means no directions are open.
//
// State: { fromQuery, fromId, toQuery, toId, path, stepIndex, error,
//          editingField, kind, autoWalking, pendingModeChoice, transportMode }
//   kind              "point" (always — the visitor picks the destination)
//   autoWalking       stepping through `path` hands-free; lives here so it
//                      can never outlive the route it walks
//   pendingModeChoice { stairsPath, elevatorPath } when the route changes
//                      floor AND a stairs-only and an elevator-only route
//                      both exist and differ, so the panel asks which. null
//                      otherwise, including when only one is possible
//                      (nothing to ask) — see chooseTransportMode.
//   transportMode     "stairs" | "elevator" once chosen (or implied by the
//                      only route available), null for a same-floor route.
//                      Kept so an off-route reroute honors it instead of
//                      quietly swapping an elevator route for stairs.
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
    pendingModeChoice: null,
    transportMode: null,
  };
}

const samePath = (a, b) => !!a && !!b && a.length === b.length && a.every((id, i) => id === b[i]);

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
//
// When the destination is on a different floor, both a stairs-only and an
// elevator-only route are computed (see pathfinding.js's mode argument).
// If both exist and actually take a different route, the visitor is asked
// which to use (pendingModeChoice) rather than silently picking one — see
// chooseTransportMode. If the floor doesn't change, or only one of the two
// is possible, there's nothing to ask: whichever route exists is used
// directly, same as before this mode split existed.
export function getDirections(d, nodes, searchableRooms) {
  let fromId = d.fromId;
  let toId = d.toId;
  if (!fromId && d.fromQuery) fromId = resolveExactNodeMatch(d.fromQuery, nodes, searchableRooms)?.id ?? fromId;
  if (!toId && d.toQuery) toId = resolveExactNodeMatch(d.toQuery, nodes, searchableRooms)?.id ?? toId;

  if (!fromId || !toId) {
    return { ...d, error: "Pick both a starting point and a destination from the suggestions, or type the exact name." };
  }

  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const sameFloor = byId[fromId] && byId[toId] && byId[fromId].floor === byId[toId].floor;

  const noRoute = { ...d, path: null, pendingModeChoice: null, error: "No walkable route found between these two points yet." };
  const found = (path, transportMode) => ({
    ...d, fromId, toId, path, stepIndex: 0, error: "", pendingModeChoice: null, transportMode,
  });

  if (sameFloor) {
    const path = findPath(nodes, fromId, toId, "any");
    return path ? found(path, null) : noRoute;
  }

  const stairsPath = findPath(nodes, fromId, toId, "stairs");
  const elevatorPath = findPath(nodes, fromId, toId, "elevator");

  if (stairsPath && elevatorPath && !samePath(stairsPath, elevatorPath)) {
    return { ...d, fromId, toId, path: null, error: "", pendingModeChoice: { stairsPath, elevatorPath } };
  }
  if (stairsPath) return found(stairsPath, "stairs");
  if (elevatorPath) return found(elevatorPath, "elevator");
  const mixed = findPath(nodes, fromId, toId, "any");
  return mixed ? found(mixed, null) : noRoute;
}

// The visitor picked "stairs" or "elevator" from pendingModeChoice.
export function chooseTransportMode(d, mode) {
  if (!d?.pendingModeChoice) return d;
  const path = mode === "elevator" ? d.pendingModeChoice.elevatorPath : d.pendingModeChoice.stairsPath;
  return { ...d, path, stepIndex: 0, error: "", pendingModeChoice: null, transportMode: mode };
}

// The way back to the route after wandering off, honoring the chosen mode.
// A stairs route may fall back to any route; an elevator route never does,
// since the visitor may have picked the elevator because they can't use
// stairs.
function reroute(nodes, fromId, toId, mode) {
  if (mode === "elevator") return findPath(nodes, fromId, toId, "elevator");
  return findPath(nodes, fromId, toId, mode || "any") || findPath(nodes, fromId, toId, "any");
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

  const path = reroute(nodes, currentId, d.toId, d.transportMode);
  if (!path) {
    const error =
      d.transportMode === "elevator"
        ? "No elevator route from here. Go back, or try Get directions again."
        : "Lost the route from here. Try Get directions again.";
    return { ...d, path: null, stepIndex: 0, error };
  }
  return { ...d, path, stepIndex: 0, error: "" };
}

// The step from where the visitor stands to the route's next stop, or null
// at the end. `hotspots` are the current node's hotspots. A step with no
// hotspot that's an elevator ride comes back as kind "elevator": it's taken
// through the landing marker, not an arrow, and arrives facing out of the
// destination landing's doors.
export function nextStep(d, hotspots, nodes) {
  const id = d?.path?.[d.stepIndex + 1];
  if (!id) return null;
  const hs = hotspots.find((h) => h.id === id);
  if (hs) return { kind: "walk", id, yaw: hs.yaw, defaultYaw: hs.defaultYaw, defaultPitch: hs.defaultPitch };
  const ride = nodes ? elevatorRideBetween(nodes, d.path[d.stepIndex], id) : null;
  if (ride) return { kind: "elevator", id, yaw: arrivalYawFromLanding(ride.toMarker), ride };
  return { kind: "walk", id };
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
//
// `nextElevator` is set when the next step is an elevator ride:
// { markerId, floor } — the landing marker to highlight where the visitor
// stands, and the floor the route rides to.
export function routeProgress(d, { byId, hotspots, entryYaw, nodes }) {
  const arrived = Boolean(d?.path && d.stepIndex === d.path.length - 1);
  const nextStopId = d?.path?.[d.stepIndex + 1] || null;
  const nextStopName = nextStopId ? byId[nextStopId]?.name || nextStopId : null;
  const nextStopHotspot = nextStopId ? hotspots.find((h) => h.id === nextStopId) || null : null;
  const ride = nextStopId && !nextStopHotspot && nodes ? elevatorRideBetween(nodes, d.path[d.stepIndex], nextStopId) : null;
  const nextElevator = ride ? { markerId: ride.fromMarker.id, floor: ride.toFloor } : null;
  const turnInstruction =
    d?.stepIndex > 0 && nextStopHotspot ? getTurnInstruction(entryYaw, nextStopHotspot.yaw) : null;
  return { arrived, nextStopId, nextStopName, nextStopHotspot, nextElevator, turnInstruction };
}

// Whether the visitor has actually begun walking the route: it exists, and
// they are standing on its first stop (or already past it). Before that the
// panel offers "Start walking" instead.
export function hasStartedWalking(d, currentId) {
  return !!d?.path && !(d.stepIndex === 0 && currentId !== d.path[0]);
}
