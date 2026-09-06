// Shortest path over the same unweighted neighbors graph the hotspot
// navigation already walks — a route through this graph is guaranteed to be
// walkable node-by-node, since it's the exact adjacency list hotspots use.
export function findPath(nodes, fromId, toId) {
  if (!fromId || !toId) return null;
  if (fromId === toId) return [fromId];

  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  if (!byId[fromId] || !byId[toId]) return null;

  const visited = new Set([fromId]);
  const queue = [[fromId]];

  while (queue.length > 0) {
    const path = queue.shift();
    const last = path[path.length - 1];
    const neighbors = byId[last]?.neighbors || [];
    for (const nb of neighbors) {
      if (visited.has(nb)) continue;
      const nextPath = [...path, nb];
      if (nb === toId) return nextPath;
      visited.add(nb);
      queue.push(nextPath);
    }
  }
  return null; // no walkable route between these two nodes
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
