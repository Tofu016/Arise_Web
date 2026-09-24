import { elevatorAdjacency } from "./elevators";

// Fire exits (transitionExit) are for emergencies only, so ordinary routing
// never passes THROUGH one. It can still start or end on one: a visitor
// standing at a fire exit has to be able to route away from it. Emergency
// routing, which would use them, isn't built yet.
const EMERGENCY_ONLY_TYPES = ["transitionExit"];

// A neighbor edge that changes floor through a Stairs (transition) node.
// This is the only signal for "this edge is a stairs edge", because
// node_neighbors has no traversal-kind column (an edge is just two ids). A
// floor-changing edge an admin drew between two plain hallway nodes,
// skipping the Stairs type, can't be recognized and will still be allowed
// in elevator mode. This only works as well as that convention is followed.
function isStairsEdge(byId, a, b) {
  const nodeA = byId[a];
  const nodeB = byId[b];
  if (!nodeA || !nodeB || nodeA.floor === nodeB.floor) return false;
  return nodeA.type === "transition" || nodeB.type === "transition";
}

// Shortest path over the walkable graph, restricted by how a floor change
// may happen:
//   "any"      neighbor edges plus elevator rides: the widest route, used
//              when there's no preference or as the last-resort fallback
//   "stairs"   neighbor edges only; never rides an elevator
//   "elevator" neighbor edges MINUS floor changes through a Stairs node,
//              PLUS elevator rides, so the only way between floors is the
//              elevator (step-free, as far as the graph's typing allows)
// Same-floor edges are never excluded by mode; only floor changes are
// mode-sensitive. In every mode, fire exits are never passed through.
export function findPath(nodes, fromId, toId, mode = "any") {
  if (!fromId || !toId) return null;
  if (fromId === toId) return [fromId];

  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  if (!byId[fromId] || !byId[toId]) return null;

  const elevatorAdj = mode === "stairs" ? null : elevatorAdjacency(nodes);
  const emergencyOnly = (id) => id !== toId && EMERGENCY_ONLY_TYPES.includes(byId[id]?.type);

  const edgesFrom = (id) => {
    const walkable = (byId[id]?.neighbors || []).filter((nb) => {
      if (emergencyOnly(nb)) return false;
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
