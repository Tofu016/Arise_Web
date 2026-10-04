import { getCustomBuildings, getServerBuildingNames } from "./buildingStore";

// GD1/GD2/GD3 share the same "Main Campus" coordinates — they're a single
// physical location (already interconnected via the node graph), not
// three separate campuses. Only the node flagged as the campus entrance
// (one per campus, see `campusEntrance`) surfaces the cross-campus minimap,
// but all three carry the coordinate for data consistency.
const MAIN_CAMPUS_LAT = 14.45890388620473;
const MAIN_CAMPUS_LNG = 120.95932439713594;

export const BUILDINGS = [
  { id: "gd1", label: "GD1", lat: MAIN_CAMPUS_LAT, lng: MAIN_CAMPUS_LNG, campus: "main" },
  { id: "gd2", label: "GD2", lat: MAIN_CAMPUS_LAT, lng: MAIN_CAMPUS_LNG, campus: "main" },
  { id: "gd3", label: "GD3", lat: MAIN_CAMPUS_LAT, lng: MAIN_CAMPUS_LNG, campus: "main" },
];

// Campus grouping now lives on the building row itself (backend's
// buildings.campus_id, COALESCE'd to the building's own id when unset — see
// Buildings_Model::selectWithCampus() in Arise_API). GD1/GD2/GD3 share
// campus_id "main" (one physical campus, already interconnected via the
// node graph, and sharing a single campus entrance setting — see
// NODE_TYPES' "entrance" and the node-level `campusEntrance` flag); any
// other building defaults to being its own solo campus until an admin
// explicitly groups it with another via that column. Reads through
// allBuildings() so admin-created buildings' groupings take effect without
// any code change here.
export function campusForBuilding(buildingId) {
  return allBuildings().find((b) => b.id === buildingId)?.campus ?? buildingId;
}

// Distinct campus groupings across every current building (built-in and
// admin-created) — the same grouping KioskCampusScreen computes inline for
// its own campus-select screen, exposed here so admin UI (AddBuildingDialog's
// campus field) can offer "join an existing campus" without recomputing it.
// Includes solo buildings (a group of one) too — there's no separate
// "campus" entity in the data model, just buildings sharing a campus_id, so
// joining a solo building's campus (i.e. taking on its own id as your
// campus_id) is exactly as valid a grouping move as joining an
// already-multi-building one. Callers that only want to offer already-formed
// groups can filter on buildingIds.length > 1 themselves.
export function allCampuses() {
  const groups = new Map(); // campusId -> { id, labels, buildingIds }
  for (const b of allBuildings()) {
    const campusId = campusForBuilding(b.id);
    const group = groups.get(campusId);
    if (group) {
      group.buildingIds.push(b.id);
      group.labels.push(b.label);
    } else {
      groups.set(campusId, { id: campusId, labels: [b.label], buildingIds: [b.id] });
    }
  }
  return [...groups.values()].map((g) => ({
    id: g.id,
    label: g.id === "main" ? "Main Campus" : g.labels.join(" / "),
    buildingIds: g.buildingIds,
  }));
}

// How a campus is named on screen: a campus of several buildings reads as
// "GD1/GD2/GD3 Building", a solo-building campus (Digital Campus) keeps its
// own name. Unlike allCampuses().label, "main" is not special-cased, so the
// name follows the buildings rather than a hardcoded "Main Campus".
export function campusDisplayName(campusId) {
  const members = allBuildings().filter((b) => campusForBuilding(b.id) === campusId);
  if (members.length === 0) return campusId;
  if (members.length === 1) return members[0].label;
  return `${members.map((b) => b.label).join("/")} Building`;
}

// One building's on-screen name: "GD1 Building" for a building inside a
// multi-building campus, the bare label for a solo-building campus
// (Digital Campus).
export function buildingDisplayName(buildingId) {
  const label = buildingLabel(buildingId);
  const campusId = campusForBuilding(buildingId);
  const siblings = allBuildings().filter((b) => campusForBuilding(b.id) === campusId);
  return siblings.length > 1 ? `${label} Building` : label;
}

// Matches the actual Unity node-name vocabulary from the source model.
// Colours keep their wayfinding hue (blue hallway, green entrance, red
// fire-exit, \u2026) but are darkened/desaturated to read on the light,
// maroon-led SDCA surfaces and to pass WCAG AA against white.
export const NODE_TYPES = [
  { id: "hallway", label: "Hallway", color: "#2f6db0" },
  { id: "lobby", label: "Lobby", color: "#b87514" },
  { id: "entrance", label: "Entrance", color: "#2e7d46" },
  { id: "stairs", label: "Stairs", color: "#8b3fb5" },
  { id: "fire_exit", label: "Fire Exit", color: "#c62a2c" },
  // Split from one combined "Open Area (parking)" type \u2014 not every open
  // area is a parking lot (e.g. DC's own open area isn't one), so an
  // admin needs to be able to say which this actually is.
  { id: "open_area", label: "Open Area", color: "#6b6663" },
  { id: "parking", label: "Parking", color: "#5b7a8a" },
  // Renamed from "Portal" to avoid reading as the mobile app's unrelated
  // AR portal feature \u2014 this is a walkable GD2<->GD3 building link.
  { id: "building_transition", label: "Building Transition", color: "#ad7f00" },
];

export const TRANSITION_TYPES = ["stairs", "fire_exit"];

// Node type ids the emergency router (utils/evacuation.js) keys off, named
// once here so a rename of a type id touches this block and nothing else.
export const STAIRS_TYPE = "stairs";
export const FIRE_EXIT_TYPE = "fire_exit";
export const BUILDING_TRANSITION_TYPE = "building_transition";
// The ground floor. Floor 1 is the ground in every building, and Underground
// (-1) lies below it. Emergency routing treats it as fixed: an Emergency Exit
// Destination Point can only be on this floor or below, and a route climbs
// above it only as a last resort.
export const GROUND_FLOOR = 1;
// The node types an admin can tick as an Emergency Exit Destination Point
// (`isEmergencyDestination`): the place a Nearest Exit route ends. Nothing is
// automatic. Whether someone who reaches the node is out of danger is the
// admin's call alone, and no type is safe by itself.
export const EMERGENCY_DESTINATION_TYPES = ["open_area", "parking", "lobby", "entrance", "fire_exit"];
// The ones that are indoor spaces, or can open into one: ticking these needs
// the most care, so the form and the coverage page warn about them.
export const EMERGENCY_DESTINATION_INDOOR_TYPES = ["lobby", "entrance"];

// Shown whenever the Nearest Exit route is on screen, so a visitor who gets
// stuck (no route, blocked way, no way down) always has someone to call.
export const EMERGENCY_CONTACTS = [
  { label: "Bacoor City Priority Emergency Hotline", number: "161 or (046) 417-0207" },
  { label: "Bureau of Fire Protection (BFP) Bacoor", number: "(046) 417-6060" },
  { label: "Bacoor CDRRMO (Rescue)", number: "(046) 417-0727" },
  { label: "Bacoor Police (PNP)", number: "(046) 417-6366" },
];

// Point-of-interest markers placed *within* a panorama at a fixed yaw/pitch —
// distinct from hotspots (which navigate to a different node). These just
// label something visible from where you're standing: a room, a facility, or
// safety equipment. One system, several categories, rather than building a
// separate feature per icon type.
// "elevator" is unlike the other four: it's clickable in the public viewer
// (rides the visitor to another floor) rather than purely informational,
// and its own navigation data (which floors it serves, its label) lives on
// a separate `elevators` record, not the marker — a landing marker just
// points at one by elevatorId, so every landing of the same physical
// elevator reads the exact same data (see utils/elevators.js). Still kept
// in this same array rather than a separate concept, since it's placed,
// positioned and rendered exactly like every other marker.
// `icon` stays plain text ("?") since this file is plain .js (no JSX
// support) and `icon` also feeds a plain-text <option> in
// NavigationEditorPage.jsx, so it can't hold the <IconPlaceholder>
// component the way JSX files do. Marker.jsx and NavigationEditorPage.jsx
// swap in the real icon for their own rendering by reading
// `iconPlaceholder` instead of `icon` when present.
export const MARKER_TYPES = [
  { id: "room", label: "Room", icon: "?", iconPlaceholder: "door", color: "#2f6db0" },
  { id: "facility", label: "Facility", icon: "?", iconPlaceholder: "location-pin", color: "#2e7d46" },
  { id: "emergency_exit", label: "Emergency Exit", icon: "?", iconPlaceholder: "emergency-exit", color: "#c62a2c" },
  { id: "fire_extinguisher", label: "Fire Extinguisher", icon: "?", iconPlaceholder: "fire-extinguisher", color: "#b5701c" },
  { id: "elevator", label: "Elevator", icon: "?", iconPlaceholder: "elevator", color: "#5b3fa0" },
];

// A single-floor "elevator" can't connect anywhere, so it isn't a real
// elevator marker — the admin form and the backend both enforce this floor.
export const MIN_ELEVATOR_FLOORS = 2;

export function markerTypeInfo(typeId) {
  return MARKER_TYPES.find((t) => t.id === typeId) || MARKER_TYPES[1];
}

// Verified directly from the exported Main_Campus_Parent.glb hierarchy —
// each building has a different real floor count, not a shared generic list.
export const BUILDING_FLOORS = {
  gd1: [-1, 1, 2, 3, 4, 5, 6, 7, 8],   // UG + Ground..8th
  gd2: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], // Ground..10th (no UG)
  gd3: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], // Ground..11th (no UG)
};

// Union of every floor across all buildings — used when no single building is selected
// (e.g. the "All" option in a building filter).
export const FLOORS = [...new Set(Object.values(BUILDING_FLOORS).flat())].sort((a, b) => a - b);

// Built-in buildings (verified from the GLB) plus any admin-created ones from
// buildingStore. Everything below reads through this instead of the raw
// BUILDINGS/BUILDING_FLOORS constants so admin-created buildings show up
// everywhere a building list is used, without altering the verified data.
export function allBuildings() {
  // Built-ins keep their hardcoded label unless an admin renamed them.
  const names = getServerBuildingNames();
  const builtIns = BUILDINGS.map((b) => ({ ...b, label: names[b.id] ?? b.label }));
  return [...builtIns, ...getCustomBuildings()];
}

export function allBuildingIds() {
  return allBuildings().map((b) => b.id);
}

export function allFloors() {
  const customFloors = getCustomBuildings().flatMap((b) => b.floors);
  return [...new Set([...FLOORS, ...customFloors])].sort((a, b) => a - b);
}

export function floorsForBuilding(buildingId) {
  if (BUILDING_FLOORS[buildingId]) return BUILDING_FLOORS[buildingId];
  const custom = getCustomBuildings().find((b) => b.id === buildingId);
  if (custom) return custom.floors;
  return allFloors();
}

export function floorLabel(floor) {
  return floor === -1 ? "Underground" : `Floor ${floor}`;
}

export function typeColor(typeId) {
  // Fallback is --ink (markers now sit on light SDCA surfaces, not a dark canvas).
  return NODE_TYPES.find((t) => t.id === typeId)?.color || "#201b1b";
}

export function typeLabel(typeId) {
  return NODE_TYPES.find((t) => t.id === typeId)?.label || typeId;
}

export function buildingLabel(buildingId) {
  return allBuildings().find((b) => b.id === buildingId)?.label || buildingId;
}

// Builds a { building }_f{ floor }_{ type }{ number } id (the type id is
// already snake_case, so it goes in as is) and picks the next
// free number for that exact building+floor+type combination, so multiple
// hallways etc. on the same floor never collide. `excludeId` lets the caller
// leave a node's own current id out of the "already used" check (used when
// suggesting a rename for a node that already occupies its own slot).
export function suggestNodeId(building, floor, type, nodes, excludeId = null) {
  const prefix = `${building}_f${floor}_${type}`;
  const pattern = new RegExp(`^${prefix}(\\d+)$`);
  const used = new Set();
  for (const n of nodes) {
    if (n.id === excludeId) continue;
    const match = n.id.match(pattern);
    if (match) used.add(Number(match[1]));
  }
  let n = 1;
  while (used.has(n)) n += 1;
  return `${prefix}${String(n).padStart(2, "0")}`;
}

// Evenly spaces hotspot arrows around the horizon for any neighbor that hasn't
// been manually positioned yet, so navigation testing works immediately without
// requiring precise placement first — precision can be added later via drag/click.
export function defaultHotspotAngle(index, total) {
  const yaw = total > 0 ? (360 / total) * index : 0;
  return { yaw, pitch: -10 };
}
