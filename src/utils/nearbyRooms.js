import { campusForBuilding } from "./constants";

// BFS hop-distance from `fromId` over the same unweighted neighbors graph
// pathfinding.js walks, flattened into nearby rooms/facilities. A node can
// list several rooms (entities.js's `rooms: string[]`), so distance is
// really "hops to the node that hosts this room" — the same room name
// reachable from multiple nodes keeps only its nearest occurrence.
//
// Same-floor rooms are unbounded by hop count by default (a floor's hallway
// network is naturally bounded); a different-floor room only counts as
// "nearby" within maxCrossFloorHops. `maxHops` additionally caps every
// result regardless of floor — off (Infinity) by default so callers that
// only care about the floor split keep the old behavior, but the kiosk's
// nearby-rooms panel passes one so a same-floor room on the far side of
// campus doesn't show up as "nearby" just because it's on the same floor.
// Cross-building hops are fine (GD1/GD2/GD3 are one interconnected campus)
// but traversal stops at a campus boundary (see campusForBuilding) — a
// portal to another campus shouldn't surface here.
export function findNearbyRooms(nodes, fromId, { maxCrossFloorHops = 5, maxHops = Infinity, limit = 5 } = {}) {
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const from = byId[fromId];
  if (!from) return [];

  const fromCampus = campusForBuilding(from.building);
  const hops = new Map([[fromId, 0]]);
  const queue = [fromId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    const dist = hops.get(currentId);
    if (dist >= maxHops) continue; // no point expanding past the cap
    for (const nb of byId[currentId]?.neighbors || []) {
      if (hops.has(nb)) continue;
      const nbNode = byId[nb];
      if (!nbNode || campusForBuilding(nbNode.building) !== fromCampus) continue;
      hops.set(nb, dist + 1);
      queue.push(nb);
    }
  }

  const nearestByRoom = new Map(); // room name -> { room, hops, nodeId, floor, building }
  for (const [nodeId, dist] of hops) {
    if (dist > maxHops) continue;
    const node = byId[nodeId];
    if (node.floor !== from.floor && dist > maxCrossFloorHops) continue;
    for (const room of node.rooms || []) {
      const existing = nearestByRoom.get(room);
      if (!existing || dist < existing.hops) {
        nearestByRoom.set(room, { room, hops: dist, nodeId, floor: node.floor, building: node.building });
      }
    }
  }

  return [...nearestByRoom.values()]
    .sort((a, b) => a.hops - b.hops || a.room.localeCompare(b.room))
    .slice(0, limit);
}
