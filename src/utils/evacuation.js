import {
  BUILDING_TRANSITION_TYPE,
  EMERGENCY_DESTINATION_TYPES,
  FIRE_STAIRS_PREFERENCE,
  GROUND_FLOOR,
  STAIRS_TYPE,
} from "./constants";
import { exitLandingEdges, isFireExitNode, landingProblems, fireExitCrossFloorLinks, emergencyExitMarkers } from "./emergencyExits";

// "Nearest Exit" routing. The goal is an Emergency Exit Destination Point:
// a node an admin ticked (`isEmergencyDestination`) to say "someone who
// reaches this node is out of danger". The router never decides that itself:
// an Entrance might open into another indoor space, and only the admin knows.
// Only the types in EMERGENCY_DESTINATION_TYPES, or a node carrying an
// emergency exit marker (a fire door to the street), can be ticked, and only
// on the ground floor or below (see canBeDestinationPoint).
//
// Two kinds of edge are walked: neighbor links, and the exit landings of a
// node's emergency exit markers (the hidden fire stairs, one directed edge per
// landing, see emergencyExits.js). An elevator ride can never be part of an
// evacuation route (the same rule as pathfinding's "stairs" mode, and a real
// fire-safety one). Fire stairs are protected, so they are favored over an
// ordinary flight of Stairs by FIRE_STAIRS_PREFERENCE extra hops: a nearby fire
// exit wins over an ordinary staircase, and one too far away loses to it. Listing
// several landings gives the visitor a way round a blocked one: the router
// takes the cheapest, usually the lowest, and the next when it is reported
// blocked.
//
// Cost is hop-based. Floors are not a distance, so changing floor adds a
// cost: a little going down, a lot going up (smoke and heat rise, and an
// evacuee shouldn't be led away from the ground). Climbing is also fenced
// off in the first search: a route may never rise above its ceiling, the
// higher of the visitor's own floor and GROUND_FLOOR. So someone in an
// underground level may climb to the ground floor, because that IS the way
// out, but nobody on floor 1 is led up and over. Only when no route within
// the ceiling exists is anything higher allowed, and the route then says so.
const COST_PER_FLOOR_DOWN = 2;
const COST_PER_FLOOR_UP = 8;
const COST_ENTERING_STAIRS = 1;
const COST_ENTERING_BUILDING_TRANSITION = 2;

function floorCost(from, to) {
  const delta = Number(to.floor) - Number(from.floor);
  if (delta < 0) return -delta * COST_PER_FLOOR_DOWN;
  if (delta > 0) return delta * COST_PER_FLOOR_UP;
  return 0;
}

// A flight of ordinary stairs: a floor change with a Stairs node at either end.
// The fire stairs preference is charged once per flight.
function isStairsFlight(from, to) {
  return Number(from.floor) !== Number(to.floor) && (from.type === STAIRS_TYPE || to.type === STAIRS_TYPE);
}

function entryCost(from, to) {
  let cost = 1 + floorCost(from, to);
  if (isStairsFlight(from, to)) cost += FIRE_STAIRS_PREFERENCE;
  if (to.type === STAIRS_TYPE) cost += COST_ENTERING_STAIRS;
  if (to.type === BUILDING_TRANSITION_TYPE) cost += COST_ENTERING_BUILDING_TRANSITION;
  return cost;
}

// Taking the hidden fire stairs from one node to its landing, however many
// floors that is: one hop plus the floors, with none of the ordinary Stairs
// charges. The gap to an ordinary flight is the preference for the protected
// stairwell.
function landingCost(from, to) {
  return 1 + floorCost(from, to);
}

// Whether a node's tick counts. The node must be of a type that can lead out,
// or carry an emergency exit marker (a fire door), and must be on the ground
// floor or below: a tick on an upper floor would end the route there, which is
// how a lobby ticked on every floor would stop anyone ever leaving it.
export function canBeDestinationPoint(node) {
  return (EMERGENCY_DESTINATION_TYPES.includes(node.type) || isFireExitNode(node)) && Number(node.floor) <= GROUND_FLOOR;
}

// The ids of every Emergency Exit Destination Point in the graph. Nothing is
// automatic and there is no fallback: a building with none ticked has none,
// and the Emergency Coverage page says so instead of the router guessing.
export function resolveDestinationPoints(nodes) {
  return new Set(nodes.filter((n) => n.isEmergencyDestination && canBeDestinationPoint(n)).map((n) => n.id));
}

// Smallest-first queue ordered by (cost, id). The id tie-break is what makes
// the answer identical every time for the same graph: an evacuation route
// must not change between two taps.
class MinQueue {
  constructor() {
    this.items = [];
  }
  get size() {
    return this.items.length;
  }
  static before(a, b) {
    return a.cost < b.cost || (a.cost === b.cost && a.id < b.id);
  }
  push(item) {
    const items = this.items;
    items.push(item);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!MinQueue.before(items[i], items[parent])) break;
      [items[i], items[parent]] = [items[parent], items[i]];
      i = parent;
    }
  }
  pop() {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let smallest = i;
        if (l < items.length && MinQueue.before(items[l], items[smallest])) smallest = l;
        if (r < items.length && MinQueue.before(items[r], items[smallest])) smallest = r;
        if (smallest === i) break;
        [items[i], items[smallest]] = [items[smallest], items[i]];
        i = smallest;
      }
    }
    return top;
  }
}

function prepare(nodes) {
  return {
    byId: Object.fromEntries(nodes.map((n) => [n.id, n])),
    destinations: resolveDestinationPoints(nodes),
    landings: exitLandingEdges(nodes),
  };
}

// Cheapest walk from `fromId` to the nearest destination point, never
// entering a blocked node or any floor above `ceiling`. Stops at the first
// destination point it settles, which is the cheapest one by construction.
function search({ byId, destinations, landings }, fromId, blocked, ceiling) {
  const best = new Map([[fromId, 0]]);
  const previous = new Map();
  const queue = new MinQueue();
  queue.push({ id: fromId, cost: 0 });

  while (queue.size > 0) {
    const { id, cost } = queue.pop();
    if (cost > best.get(id)) continue; // a cheaper way here was already settled
    if (destinations.has(id)) {
      const path = [id];
      while (previous.has(path[0])) path.unshift(previous.get(path[0]));
      return { path, destinationId: id };
    }
    const here = byId[id];
    const steps = [
      ...(here.neighbors || []).map((toId) => ({ toId, price: entryCost })),
      ...(landings.get(id) || []).map(({ toId }) => ({ toId, price: landingCost })),
    ];
    for (const { toId: nbId, price } of steps) {
      const nb = byId[nbId];
      if (!nb || blocked.has(nbId)) continue;
      if (Number(nb.floor) > ceiling) continue;
      const next = cost + price(here, nb);
      if (next < (best.get(nbId) ?? Infinity)) {
        best.set(nbId, next);
        previous.set(nbId, id);
        queue.push({ id: nbId, cost: next });
      }
    }
  }
  return null;
}

// Whether the route rises above the ceiling: that is, climbs past both the
// visitor's own floor and the ground floor.
function risesAbove(byId, path, ceiling) {
  return path.some((id) => Number(byId[id].floor) > ceiling);
}

function route(ctx, fromId, blocked) {
  const { byId, destinations } = ctx;
  if (!fromId || !byId[fromId]) return null;
  if (destinations.has(fromId)) {
    return { path: [fromId], destinationId: fromId, ascends: false };
  }
  const ceiling = Math.max(Number(byId[fromId].floor), GROUND_FLOOR);
  // First within the ceiling; then, as a last resort, with no ceiling at
  // all, reported as ascending.
  for (const limit of [ceiling, Infinity]) {
    const found = search(ctx, fromId, blocked, limit);
    if (found) return { ...found, ascends: risesAbove(byId, found.path, ceiling) };
  }
  return null;
}

// The route to the nearest destination point from `fromId`, or null when
// there is none. `blocked` is a list of node ids the visitor reported
// impassable.
// Result: { path, destinationId, ascends }
//   ascends     the route rises above both the visitor's floor and the
//               ground floor, because no way within that exists. The panel
//               must warn about it.
export function findEvacuationRoute(nodes, fromId, { blocked = [] } = {}) {
  return route(prepare(nodes), fromId, new Set(blocked));
}

// What the admin's Emergency Coverage page shows: how well the graph as
// authored actually gets people out. One entry per node, classified by the
// route a visitor standing there would get:
//   "destination"  the node is itself a destination point
//   "ok"           a route that stays within the ceiling
//   "ascends"      the only route climbs above the ground floor first
//   "none"         no route at all
// `viaFireStairs` says whether that route takes any hidden fire stairs.
// Alongside the entries, the authoring problems around emergency exit markers:
//   landingProblems        a landing that is missing, itself, in another
//                          building, or on the same floor
//   markersWithoutLanding  fire exit nodes with nothing to lead down and not
//                          ticked as a destination themselves (a fire door
//                          that was never given a landing, or never placed)
//   crossFloorLinks        a fire exit node with landings that also has an
//                          ordinary link to another floor
export function auditEmergencyCoverage(nodes) {
  const ctx = prepare(nodes);
  const none = new Set();

  const takesFireStairs = (path) =>
    path.some((id, i) => i > 0 && (ctx.landings.get(path[i - 1]) || []).some((l) => l.toId === id) && !(ctx.byId[path[i - 1]].neighbors || []).includes(id));

  const entries = nodes.map((n) => {
    const result = route(ctx, n.id, none);
    let status = "ok";
    if (!result) status = "none";
    else if (ctx.destinations.has(n.id)) status = "destination";
    else if (result.ascends) status = "ascends";
    return {
      id: n.id,
      name: n.name,
      building: n.building,
      floor: n.floor,
      status,
      destinationId: result?.destinationId ?? null,
      hops: result ? result.path.length - 1 : null,
      viaFireStairs: result ? takesFireStairs(result.path) : false,
    };
  });

  const brief = (n) => ({ id: n.id, name: n.name, building: n.building, floor: n.floor });

  const buildings = [...new Set(nodes.map((n) => n.building))].sort();
  const destinationPoints = nodes
    .filter((n) => ctx.destinations.has(n.id))
    .map((n) => ({ id: n.id, name: n.name, building: n.building, floor: n.floor, type: n.type }));

  return {
    entries,
    destinationPoints,
    // Buildings with no destination point at all: every node in them can only
    // route out through another building, or not at all.
    buildingsWithoutDestination: buildings.filter((b) => !destinationPoints.some((d) => d.building === b)),
    landingProblems: landingProblems(nodes).map((p) => ({ ...p, ...brief(ctx.byId[p.nodeId]) })),
    markersWithoutLanding: nodes
      .filter(
        (n) =>
          emergencyExitMarkers(n).some((m) => (m.landings || []).length === 0) &&
          !emergencyExitMarkers(n).some((m) => (m.landings || []).length > 0) &&
          !ctx.destinations.has(n.id)
      )
      .map(brief),
    crossFloorLinks: fireExitCrossFloorLinks(nodes).map((l) => ({ ...l, ...brief(ctx.byId[l.nodeId]) })),
    // Ticked, but on a type or floor that can't count, so it is ignored.
    misflagged: nodes
      .filter((n) => n.isEmergencyDestination && !canBeDestinationPoint(n))
      .map((n) => ({ id: n.id, name: n.name, building: n.building, floor: n.floor, type: n.type })),
    counts: {
      total: entries.length,
      destination: entries.filter((e) => e.status === "destination").length,
      ok: entries.filter((e) => e.status === "ok").length,
      ascends: entries.filter((e) => e.status === "ascends").length,
      none: entries.filter((e) => e.status === "none").length,
    },
  };
}
