// The visitor's position in the tour, as plain state plus transitions —
// no React, no clock, no globals: `now` and the campus (`world`) are
// passed in, so every rule here is testable by calling a function.
//
// State: { currentId, history, entryYaw, entryPitch, arrival, flyover, lastNavAt }
//   currentId   node the visitor is standing at (null until the tour lands)
//   history     stack of previous node ids, for Back
//   entryYaw    the yaw the visitor arrived facing
//   entryPitch  the pitch the visitor arrived facing
//   arrival     counts applied moves, so the viewer can tell a fresh arrival
//               apart even when it lands on the node already on screen
//               (e.g. jumping to a room in the panorama being looked at)
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
// are one campus (one position, see campusPosition), so moves between them don't.

import { hotspotAngle } from "./hotspots";

export const NAV_DEBOUNCE_MS = 500;

export function initialNavigation() {
  return { currentId: null, history: [], entryYaw: 0, entryPitch: 0, arrival: 0, flyover: null, lastNavAt: 0 };
}

// Deterministic "where do we start" pick: the Main Campus entrance (the
// node an admin flagged campusEntrance, shared across GD1/GD2/GD3) wins
// outright when one exists, since that's the single front door visitors
// should land at. Otherwise prefer an entrance, in building order (GD1,
// GD2, GD3, then any admin-added buildings), lowest floor first. Falls
// back to the first node at all if the data has no entrances tagged.
export function pickDefaultNode(nodes, buildings) {
  if (!nodes || nodes.length === 0) return null;
  const campusOf = (buildingId) => buildings.find((b) => b.id === buildingId)?.campus ?? buildingId;
  const mainEntrance = nodes.find((n) => n.campusEntrance && campusOf(n.building) === "main");
  if (mainEntrance) return mainEntrance;
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

// Every floor with at least one node in a building, low to high — used by
// the floor pickers (the kiosk's after-building screen, and the mobile
// dock's "change building" dialog).
export function floorsForBuilding(nodes, buildingId) {
  if (!nodes) return [];
  return [...new Set(nodes.filter((n) => n.building === buildingId).map((n) => Number(n.floor)))].sort(
    (a, b) => a - b
  );
}

// The kiosk floor screen's entrance shortcuts for one building: whichever
// node an admin flagged as that building's own Building entrance, and
// whichever node is the Campus entrance for the campus it belongs to (which
// may be a different GD1/GD2/GD3 building — see campusForBuilding). When
// both land on the very same node, it's offered once, as the campus
// entrance (the broader of the two labels covers the narrower one).
export function findKioskEntranceShortcuts(nodes, buildingId, campusForBuilding) {
  if (!nodes || !buildingId) return [];
  const buildingEntrance = nodes.find((n) => n.building === buildingId && n.buildingEntrance);
  const campusEntrance = nodes.find(
    (n) => n.campusEntrance && campusForBuilding(n.building) === campusForBuilding(buildingId)
  );
  if (buildingEntrance && campusEntrance && buildingEntrance.id === campusEntrance.id) {
    return [{ key: "campus", label: "Campus Entrance", nodeId: campusEntrance.id }];
  }
  const shortcuts = [];
  if (buildingEntrance) shortcuts.push({ key: "building", label: "Building Entrance", nodeId: buildingEntrance.id });
  if (campusEntrance) shortcuts.push({ key: "campus", label: "Campus Entrance", nodeId: campusEntrance.id });
  return shortcuts;
}

// The kiosk building screen's "Campus Entrance" entry: the one node an
// admin flagged as the shared entrance for the whole Main Campus cluster.
export function findMainCampusEntrance(nodes, campusForBuilding) {
  return (nodes || []).find((n) => n.campusEntrance && campusForBuilding(n.building) === "main") || null;
}

// Same lookup, generalized to any campus — used by the kiosk building
// screen for whichever campus is currently selected, not just Main Campus.
export function findCampusEntrance(nodes, campusId, campusForBuilding) {
  return (nodes || []).find((n) => n.campusEntrance && campusForBuilding(n.building) === campusId) || null;
}

// Every building belonging to one campus (id resolved via campusForBuilding).
// Used to decide whether picking a campus should stop at a building screen
// (more than one member) or land straight on that solo building.
export function buildingsForCampus(buildings, campusId, campusForBuilding) {
  return (buildings || []).filter((b) => campusForBuilding(b.id) === campusId);
}

// Whether a single-building campus's kiosk building screen actually has
// something worth stopping for: more than one floor, or an entrance
// shortcut to offer. When neither, the floor screen has nothing meaningful
// to ask, so the kiosk skips straight past it.
export function kioskBuildingHasChoice(nodes, buildingId, campusForBuilding) {
  return (
    floorsForBuilding(nodes, buildingId).length > 1 ||
    findKioskEntranceShortcuts(nodes, buildingId, campusForBuilding).length > 0
  );
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
// stand at the default node, facing its own starting view if it has one.
export function landOnDefault(nav, nodes, buildings) {
  if (!nodes || nav.currentId !== null) return nav;
  const start = pickDefaultNode(nodes, buildings);
  if (!start) return nav;
  return { ...nav, currentId: start.id, entryYaw: start.startingViewYaw ?? 0, entryPitch: start.startingViewPitch ?? 0 };
}

// One campus has one position on the map: every building in it answers with
// the coordinates of the first building of that campus that has any, so a
// building whose own coordinates drifted (or were never set) cannot split a
// campus in two. Buildings with no `campus` are their own campus.
function campusPosition(building, buildings) {
  const campus = building.campus ?? building.id;
  const anchor = buildings.find((b) => (b.campus ?? b.id) === campus && b.lat != null && b.lng != null);
  return { campus, lat: anchor?.lat, lng: anchor?.lng };
}

// The flyover descriptor for moving between two nodes, or null when it's
// not a cross-campus move: the two ends must be in different campuses, both
// with real coordinates, and those must differ. Moves inside one campus
// (GD1/GD2/GD3) never fly, whatever their buildings' own coordinates say.
export function findFlyover(fromNode, toNode, buildings) {
  if (!fromNode || !toNode) return null;
  const from = buildings.find((b) => b.id === fromNode.building);
  const to = buildings.find((b) => b.id === toNode.building);
  if (!from || !to) return null;
  const a = campusPosition(from, buildings);
  const b = campusPosition(to, buildings);
  if (a.campus === b.campus) return null;
  if (a.lat == null || b.lat == null) return null;
  if (a.lat === b.lat && a.lng === b.lng) return null;
  return {
    fromLat: a.lat,
    fromLng: a.lng,
    fromLabel: from.label || fromNode.building,
    toLat: b.lat,
    toLng: b.lng,
    toLabel: to.label || toNode.building,
  };
}

function applyMove(prev, action) {
  // Back with nothing to go back to lands nowhere, so it's no arrival.
  if (action.type === "back" && prev.history.length === 0) return prev;
  const nav = { ...prev, arrival: prev.arrival + 1 };
  if (action.type === "back") {
    const history = [...nav.history];
    const currentId = history.pop();
    return { ...nav, currentId, history, entryYaw: action.yaw ?? 0, entryPitch: action.pitch ?? 0 };
  }
  if (action.type === "walk") {
    return {
      ...nav,
      // A skip-ahead walk carries the nodes it passed over (`via`), so Back
      // still retraces the hallway one stop at a time.
      history: nav.currentId ? [...nav.history, nav.currentId, ...(action.via || [])] : nav.history,
      currentId: action.id,
      entryYaw: action.yaw ?? 0,
      entryPitch: action.pitch ?? 0,
    };
  }
  // jump: a fresh start, facing whatever the caller aimed it at (a room's
  // marker, or the destination's own starting view, e.g. landing on a
  // floor's starting node from the floor/building picker), else dead ahead.
  return { ...nav, history: [], currentId: action.id, entryYaw: action.yaw ?? 0, entryPitch: action.pitch ?? 0 };
}

function request(nav, world, action, now) {
  // A kiosk gets mashed: a fast double-tap must not queue two moves. One
  // shared cooldown across every kind of move.
  if (now - nav.lastNavAt < NAV_DEBOUNCE_MS) return { nav, outcome: "ignored" };
  const accepted = { ...nav, lastNavAt: now };

  const targetId = action.type === "back" ? nav.history[nav.history.length - 1] : action.id;
  // Facing back the way you came: land on the hotspot in the returning-to
  // node that points at the node you're leaving, so it's centered on arrival
  // instead of resetting to dead ahead.
  const backAction =
    action.type === "back"
      ? { ...action, ...(hotspotAngle(world.byId[targetId], nav.currentId) || {}) }
      : action;
  const flyover = findFlyover(world.byId[nav.currentId], world.byId[targetId], world.buildings);
  if (flyover) {
    return { nav: { ...accepted, flyover: { ...flyover, pending: backAction } }, outcome: "flyover" };
  }
  return { nav: applyMove(accepted, backAction), outcome: "moved", action: backAction };
}

// Landing directly on a node, bypassing the flyover check entirely — for the
// kiosk's own campus/building/floor sequence, which picks where the visitor
// starts. That start is coming from nowhere the visitor ever actually stood
// (the placeholder default node from landOnDefault, never shown on screen),
// so it isn't a building "transition" and shouldn't get a flyover.
export function requestLand(nav, world, action, now) {
  if (now - nav.lastNavAt < NAV_DEBOUNCE_MS) return { nav, outcome: "ignored" };
  const accepted = { ...nav, lastNavAt: now };
  const landAction = { ...action, type: "jump" };
  return { nav: applyMove(accepted, landAction), outcome: "moved", action: landAction };
}

// action: { id, yaw?, pitch?, via?, meta? } — `via` lists the nodes a
// skip-ahead walk passes over, in order, for the history.
export function requestWalk(nav, world, action, now) {
  return request(nav, world, { ...action, type: "walk" }, now);
}

// action: { id, yaw?, pitch?, meta? } — yaw/pitch given for a jump onto a
// node with its own starting view (see pickFloorStart's callers).
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
