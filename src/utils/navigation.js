// The visitor's position in the tour, as plain state plus transitions —
// no React, no clock, no globals: `now` and the campus (`world`) are
// passed in, so every rule here is testable by calling a function.
//
// State: { currentId, history, entryYaw, flyover, lastNavAt }
//   currentId   node the visitor is standing at (null until the tour lands)
//   history     stack of previous node ids, for Back
//   entryYaw    the yaw the visitor arrived facing
//   flyover     the cross-campus flyover in progress, or null; it carries
//               the move it is holding back (`pending`)
//   lastNavAt   timestamp of the last accepted move, for the debounce
//
// world: { byId, buildings } — nodes keyed by id, and allBuildings().
//
// Every move goes through requestMove / requestBack, which return
//   { nav, outcome, action }
// outcome is "ignored" (debounced), "flyover" (held back behind a
// flyover) or "moved". `action` is the move that was applied, present on
// "moved" — callers use it to update whatever else should follow a move.
// The move's `meta` is carried through untouched for that purpose.
//
// A move is a "walk" (hotspot click: pushes history, faces the way you
// went), a "jump" (search result/entrance/room: fresh start, clears
// history) or a "back". Any move between two places with different real
// coordinates is a cross-campus teleport and gets a flyover — GD1/GD2/GD3
// share coordinates (one physical cluster), so moves between them don't.

export const NAV_DEBOUNCE_MS = 500;

export function initialNavigation() {
  return { currentId: null, history: [], entryYaw: 0, flyover: null, lastNavAt: 0 };
}

// Deterministic "where do we start" pick: prefer an entrance, in building
// order (GD1, GD2, GD3, then any admin-added buildings), lowest floor first.
// Falls back to the first node at all if the data has no entrances tagged.
export function pickDefaultNode(nodes, buildings) {
  if (!nodes || nodes.length === 0) return null;
  const entrances = nodes.filter((n) => n.type === "entrance");
  if (entrances.length === 0) return nodes[0];
  const order = buildings.map((b) => b.id);
  return [...entrances].sort((a, b) => {
    const ai = order.indexOf(a.building);
    const bi = order.indexOf(b.building);
    if (ai !== bi) return ai - bi;
    return (a.floor ?? 0) - (b.floor ?? 0);
  })[0];
}

// Same idea, scoped to one building — used by the mobile bottom Building
// selector, which has no separate entrances list to browse, so picking a
// building jumps straight there.
export function pickDefaultEntranceForBuilding(nodes, buildingId) {
  if (!nodes) return null;
  const inBuilding = nodes.filter((n) => n.type === "entrance" && n.building === buildingId);
  if (inBuilding.length === 0) return null;
  return [...inBuilding].sort((a, b) => (a.floor ?? 0) - (b.floor ?? 0))[0];
}

// Where a visitor lands on one floor of a building: the node an admin
// flagged as that floor's starting node, else the floor's first entrance,
// else its first node. Null if the floor has no nodes.
export function pickFloorStart(nodes, buildingId, floor) {
  if (!nodes) return null;
  const onFloor = nodes.filter((n) => n.building === buildingId && Number(n.floor) === Number(floor));
  return onFloor.find((n) => n.startingNode) || onFloor.find((n) => n.type === "entrance") || onFloor[0] || null;
}

// Where picking a whole building lands: the start of its lowest floor above
// ground (floor > 0) that has nodes; failing that, its default entrance or
// any node (buildings with only underground nodes).
export function pickBuildingStart(nodes, buildingId) {
  if (!nodes) return null;
  const floors = [...new Set(nodes.filter((n) => n.building === buildingId).map((n) => Number(n.floor)))];
  const firstFloor = floors.filter((f) => f > 0).sort((a, b) => a - b)[0];
  if (firstFloor !== undefined) return pickFloorStart(nodes, buildingId, firstFloor);
  return pickDefaultEntranceForBuilding(nodes, buildingId) || nodes.find((n) => n.building === buildingId) || null;
}

// Land directly in the tour: once nodes exist and nowhere is chosen yet,
// stand at the default node.
export function landOnDefault(nav, nodes, buildings) {
  if (!nodes || nav.currentId !== null) return nav;
  const start = pickDefaultNode(nodes, buildings);
  return start ? { ...nav, currentId: start.id } : nav;
}

// The flyover descriptor for moving between two nodes, or null when it's
// not a cross-campus move: both ends need real coordinates, and they must
// differ.
export function findFlyover(fromNode, toNode, buildings) {
  if (!fromNode || !toNode) return null;
  const from = buildings.find((b) => b.id === fromNode.building);
  const to = buildings.find((b) => b.id === toNode.building);
  if (from?.lat == null || to?.lat == null) return null;
  if (from.lat === to.lat && from.lng === to.lng) return null;
  return {
    fromLat: from.lat,
    fromLng: from.lng,
    fromLabel: from.label || fromNode.building,
    toLat: to.lat,
    toLng: to.lng,
    toLabel: to.label || toNode.building,
  };
}

function applyMove(nav, action) {
  if (action.type === "back") {
    if (nav.history.length === 0) return nav;
    const history = [...nav.history];
    const currentId = history.pop();
    return { ...nav, currentId, history, entryYaw: 0 };
  }
  if (action.type === "walk") {
    return {
      ...nav,
      history: nav.currentId ? [...nav.history, nav.currentId] : nav.history,
      currentId: action.id,
      entryYaw: action.yaw ?? 0,
    };
  }
  return { ...nav, history: [], currentId: action.id, entryYaw: 0 }; // jump
}

function request(nav, world, action, now) {
  // A kiosk gets mashed: a fast double-tap must not queue two moves. One
  // shared cooldown across every kind of move.
  if (now - nav.lastNavAt < NAV_DEBOUNCE_MS) return { nav, outcome: "ignored" };
  const accepted = { ...nav, lastNavAt: now };

  const targetId = action.type === "back" ? nav.history[nav.history.length - 1] : action.id;
  const flyover = findFlyover(world.byId[nav.currentId], world.byId[targetId], world.buildings);
  if (flyover) {
    return { nav: { ...accepted, flyover: { ...flyover, pending: action } }, outcome: "flyover" };
  }
  return { nav: applyMove(accepted, action), outcome: "moved", action };
}

// action: { id, yaw?, meta? }
export function requestWalk(nav, world, action, now) {
  return request(nav, world, { ...action, type: "walk" }, now);
}

export function requestJump(nav, world, action, now) {
  return request(nav, world, { ...action, type: "jump" }, now);
}

// Going back with nothing to go back to is still an accepted, "moved"
// request (it consumes the debounce window), just with no change.
export function requestBack(nav, world, now) {
  return request(nav, world, { type: "back" }, now);
}

// The flyover finished (or was skipped): perform the move it was holding.
export function completeFlyover(nav) {
  if (!nav.flyover) return { nav, outcome: "ignored" };
  const action = nav.flyover.pending;
  return { nav: applyMove({ ...nav, flyover: null }, action), outcome: "moved", action };
}

// Cancelling just closes the flyover — the visitor stays exactly where
// they were.
export function cancelFlyover(nav) {
  return nav.flyover ? { ...nav, flyover: null } : nav;
}
