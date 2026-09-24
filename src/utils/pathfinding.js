import { TRANSITION_TYPES } from "./constants";
import { elevatorAdjacency } from "./elevators";

// A neighbor edge that changes floor through a transition/transitionExit
// node (stairs, fire exit) — the ONLY signal available for "this edge is a
// stairs edge", since node_neighbors carries no traversal-kind column of
// its own (an edge is just two ids). This is a real limitation, not just an
// implementation shortcut: a floor-changing edge an admin drew between two
// plain hallway nodes (skipping the transition-type convention) can't be
// told apart from one that's supposed to be elevator-only, and will still
// be offered under "stairs". See SESSION.md / README's transition-type
// convention — this only works as well as that convention is followed.
function isStairsEdge(byId, a, b) {
  const nodeA = byId[a];
  const nodeB = byId[b];
  if (!nodeA || !nodeB || nodeA.floor === nodeB.floor) return false;
  return TRANSITION_TYPES.includes(nodeA.type) || TRANSITION_TYPES.includes(nodeB.type);
}

// Shortest path over the walkable graph, optionally restricted by how a
// floor change is allowed to happen:
//   "any"      every neighbor edge plus every elevator connection — the
//              widest possible route, used to check reachability at all
//   "stairs"   neighbor edges only (today's behavior, unchanged) — an
//              elevator connection is never a literal hotspot arrow, so it
//              can't be walked as a stairs-mode step
//   "elevator" neighbor edges MINUS stairs-type floor changes, PLUS every
//              elevator connection — forces a floor change through an
//              elevator marker instead of a transition node, wherever one
//              exists
// A same-floor edge is never excluded by mode — only a FLOOR CHANGE is
// mode-sensitive, so "elevator" mode still uses ordinary hallway walking to
// actually reach the elevator's landing marker.
export function findPath(nodes, fromId, toId, mode = "any") {
  if (!fromId || !toId) return null;
  if (fromId === toId) return [fromId];

  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  if (!byId[fromId] || !byId[toId]) return null;

  const elevatorAdj = mode === "stairs" ? null : elevatorAdjacency(nodes);

  const edgesFrom = (id) => {
    const walkable = (byId[id]?.neighbors || []).filter((nb) => {
      if (mode !== "elevator") return true;
      return !isStairsEdge(byId, id, nb);
    });
    const viaElevator = elevatorAdj ? [...(elevatorAdj.get(id) || [])] : [];
    return mode === "stairs" ? walkable : [...new Set([...walkable, ...viaElevator])];
  };

  const visited = new Set([fromId]);
  const queue = [[fromId]];

  while (queue.length > 0) {
    const path = queue.shift();
    const last = path[path.length - 1];
    for (const nb of edgesFrom(last)) {
      if (visited.has(nb)) continue;
      const nextPath = [...path, nb];
      if (nb === toId) return nextPath;
      visited.add(nb);
      queue.push(nextPath);
    }
  }
  return null; // no route between these two nodes under this mode
}

// Turn-by-turn instruction ("Go straight through" / "Turn left toward" /
// "Turn right toward" / "Turn around toward"), computed from data that
// already exists — no new collection needed. entryYaw is the direction
// you're currently facing (the yaw of the hotspot you just walked
// through to arrive here); targetYaw is the yaw of the NEXT hotspot you
// need to take. The relative angle between them is the actual turn.
//
// Yaw convention matches toPosition() in PanoramaNav.jsx: 0 points along
// -Z, increasing yaw rotates clockwise viewed from above — so a positive
// clockwise delta is a RIGHT turn, negative is LEFT. Thresholds are
// deliberately generous (25°/155°) since hotspot angles are placed by
// eye, not surveyed — a real 5° kink shouldn't read as a "turn."
export function getTurnInstruction(entryYaw, targetYaw) {
  if (entryYaw == null || targetYaw == null) return null;
  const delta = ((targetYaw - entryYaw + 540) % 360) - 180; // normalized to -180..+180
  const abs = Math.abs(delta);
  if (abs < 25) return "Go straight through";
  if (abs > 155) return "Turn around toward";
  return delta > 0 ? "Turn right toward" : "Turn left toward";
}
