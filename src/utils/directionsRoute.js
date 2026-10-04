import { findPath, getTurnInstruction } from "./pathfinding";
import { findEvacuationRoute } from "./evacuation";
import { resolveExactNodeMatch } from "./search";
import { elevatorRideBetween, arrivalYawFromLanding } from "./elevators";
import { hotspotAngle } from "./hotspots";

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
//   emergency         null for an ordinary route. For a "Nearest Exit" route:
//                      { blocked, ascends }: the node ids the
//                      visitor reported impassable, and whether the route
//                      has to rise above the ground floor (see
//                      evacuation.js). While set,
//                      re-routing aims at the nearest exit again instead of
//                      the fixed destination, and any edit to From/To drops it.
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
    emergency: null,
  };
}

const samePath = (a, b) => !!a && !!b && a.length === b.length && a.every((id, i) => id === b[i]);

export function openDirectionsTo(current, node) {
  return { ...blank(current, "point"), toQuery: node.name, toId: node.id };
}

// Kiosk "Custom Location": the destination is already chosen, the starting
// point is left blank and being edited, so its suggestions show right away.
export function openDirectionsToWithBlankOrigin(node) {
  return { ...blank(null, "point"), toQuery: node.name, toId: node.id, editingField: "from" };
}

// Kiosk "Current Location" / "Kiosk Location": both ends known, ready for
// getDirections without any typing.
export function openDirectionsBetween(fromNode, toNode) {
  return { ...blank(fromNode, "point"), toQuery: toNode.name, toId: toNode.id };
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
  return { ...d, [queryKey(field)]: value, [idKey(field)]: null, editingField: field, path: null, error: "", emergency: null };
}

export function focusField(d, field) {
  return { ...d, editingField: field };
}

export function pickNodeField(d, field, node) {
  return { ...d, [queryKey(field)]: node.name, [idKey(field)]: node.id, editingField: null, emergency: null };
}

// A ROOM result: the navigable target is still the room's own node
// (pathfinding operates over nodes), but the field shows the room's name,
// since that's what was searched for and picked.
export function pickRoomField(d, field, room) {
  return { ...d, [queryKey(field)]: room.roomName, [idKey(field)]: room.node.id, editingField: null, emergency: null };
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

// The "Nearest Exit" route: from d.fromId to the nearest destination point (see
// evacuation.js), skipping name resolution and the stairs/elevator question
// entirely: an elevator is never offered as an evacuation route. The
// destination is chosen here, not by the caller, so every re-route (after
// wandering off, or after a way is reported blocked) can pick a new exit.
// With no route the panel is left open with the error, and the caller's
// panel shows the emergency contacts alongside it.
export function getEmergencyDirections(d, nodes) {
  const blocked = d?.emergency?.blocked ?? [];
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const base = {
    ...d,
    fromQuery: byId[d?.fromId]?.name ?? d?.fromQuery ?? "",
    toId: null,
    toQuery: "",
    path: null,
    stepIndex: 0,
    pendingModeChoice: null,
    transportMode: null,
  };

  const result = d?.fromId ? findEvacuationRoute(nodes, d.fromId, { blocked }) : null;
  if (!result) {
    return {
      ...base,
      error: blocked.length
        ? "No other way out was found from here."
        : "No safe way out was found from here.",
      emergency: { blocked, ascends: false },
    };
  }

  const destination = byId[result.destinationId];
  const changesFloor = result.path.some((id) => byId[id].floor !== destination.floor);
  return {
    ...base,
    toId: destination.id,
    toQuery: destination.name,
    path: result.path,
    error: "",
    transportMode: changesFloor ? "stairs" : null,
    emergency: { blocked, ascends: result.ascends },
  };
}

// "This way is blocked": the visitor reports the next stop impassable
// (smoke, fire, a locked door). It is excluded for the rest of this
// emergency route and the way out is recomputed from where they stand.
// With every way out blocked there is no route, and the panel says so.
export function blockNextStop(d, nodes, currentId) {
  if (!d?.emergency || !d.path) return d;
  const here = d.path.includes(currentId) ? currentId : d.path[d.stepIndex];
  const blockedId = d.path[d.path.indexOf(here) + 1];
  if (!blockedId) return d;
  return getEmergencyDirections(
    { ...d, fromId: here, emergency: { ...d.emergency, blocked: [...new Set([...d.emergency.blocked, blockedId])] } },
    nodes
  );
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

  // Off an emergency route: aim at whichever exit is nearest from here, not
  // the old one, which may now be the wrong way.
  if (d.emergency) return getEmergencyDirections({ ...d, fromId: currentId }, nodes);

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

// How far (degrees) a hallway node's way on may bend away from straight
// ahead and still count as the same hallway line. Tighter than
// getTurnInstruction's 25: hotspot yaws are placed by eye, and a wrongly
// refused skip only costs a shorter skip, while a wrongly allowed one
// skips a real corner.
export const STRAIGHT_RUN_TOLERANCE_DEG = 15;

const angleOff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

// Whether the route passes straight through `mid` between `prev` and `next`:
// all three are on one floor and building, `mid` is a plain hallway Node
// with no side branch (any third neighbor is a junction, where the visitor
// should get to look around), and the hotspot on to `next` points the
// opposite way to the hotspot back to `prev`.
function passesStraightThrough(byId, prevId, midId, nextId) {
  const prev = byId[prevId];
  const mid = byId[midId];
  const next = byId[nextId];
  if (!prev || !mid || !next || mid.type !== "hallway") return false;
  if (prev.floor !== mid.floor || next.floor !== mid.floor) return false;
  if (prev.building !== mid.building || next.building !== mid.building) return false;
  if ((mid.neighbors || []).some((id) => id !== prevId && id !== nextId)) return false;
  const back = hotspotAngle(mid, prevId);
  const ahead = hotspotAngle(mid, nextId);
  if (!back || !ahead) return false;
  return angleOff(ahead.yaw, back.yaw + 180) <= STRAIGHT_RUN_TOLERANCE_DEG;
}

// The "Skip hallway" move: how far the visitor can jump ahead along the
// route without losing a decision. Starting from the next stop, the run keeps
// going while each stop passed is a straight hallway Node (see
// passesStraightThrough) and ends on the first stop that is not: a corner,
// a junction, a door, stairs, the destination. Null when there is nothing to
// skip (fewer than two stops ahead on the line), on an emergency route (each
// stop is seen and can be reported blocked), or when no route is being walked.
//
// { targetId, via, count, angle }: `via` are the stops passed over, in order;
// `count` the stops advanced (`via.length + 1`); `angle` is the last hop's
// hotspot, so the visitor arrives still facing along the hallway.
export function straightRunAhead(d, byId) {
  if (!d?.path || d.emergency) return null;
  const { path, stepIndex } = d;
  let end = stepIndex + 1;
  while (end < path.length - 1 && passesStraightThrough(byId, path[end - 1], path[end], path[end + 1])) end++;
  const via = path.slice(stepIndex + 1, end);
  if (via.length === 0 || end > path.length - 1) return null;
  const angle = hotspotAngle(byId[path[end - 1]], path[end]);
  return { targetId: path[end], via, count: via.length + 1, angle: angle && { yaw: angle.yaw, defaultYaw: angle.defaultYaw, defaultPitch: angle.defaultPitch } };
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
