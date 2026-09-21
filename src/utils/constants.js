import { getCustomBuildings, getServerBuildingNames } from "./buildingStore";

// GD1/GD2/GD3 share the same "Main Campus" coordinates — they're a single
// physical location (already interconnected via the node graph), not
// three separate campuses. Only GD1's entrance node actually surfaces the
// cross-campus minimap (per the minimap feature's own scoping — one
// representative entry point per cluster, not one per building), but all
// three carry the coordinate for data consistency.
const MAIN_CAMPUS_LAT = 14.45890388620473;
const MAIN_CAMPUS_LNG = 120.95932439713594;

export const BUILDINGS = [
  { id: "gd1", label: "GD1", lat: MAIN_CAMPUS_LAT, lng: MAIN_CAMPUS_LNG },
  { id: "gd2", label: "GD2", lat: MAIN_CAMPUS_LAT, lng: MAIN_CAMPUS_LNG },
  { id: "gd3", label: "GD3", lat: MAIN_CAMPUS_LAT, lng: MAIN_CAMPUS_LNG },
];

// Matches the actual Unity node-name vocabulary from the source model.
// Colours keep their wayfinding hue (blue hallway, green entrance, red
// fire-exit, \u2026) but are darkened/desaturated to read on the light,
// maroon-led SDCA surfaces and to pass WCAG AA against white.
export const NODE_TYPES = [
  { id: "hallway", label: "Hallway", color: "#2f6db0" },
  { id: "lobby", label: "Lobby", color: "#b87514" },
  { id: "entrance", label: "Entrance", color: "#2e7d46" },
  { id: "transition", label: "Stairs", color: "#8b3fb5" },
  { id: "transitionExit", label: "Fire Exit", color: "#c62a2c" },
  // Split from one combined "Open Area (parking)" type \u2014 not every open
  // area is a parking lot (e.g. DC's own open area isn't one), so an
  // admin needs to be able to say which this actually is.
  { id: "openArea", label: "Open Area", color: "#6b6663" },
  { id: "parking", label: "Parking", color: "#5b7a8a" },
  // Renamed from "Portal" to avoid reading as the mobile app's unrelated
  // AR portal feature \u2014 this is a walkable GD2<->GD3 building link.
  { id: "portal", label: "Building Transition", color: "#ad7f00" },
];

export const TRANSITION_TYPES = ["transition", "transitionExit"];

// Point-of-interest markers placed *within* a panorama at a fixed yaw/pitch —
// distinct from hotspots (which navigate to a different node). These just
// label something visible from where you're standing: a room, a facility, or
// safety equipment. One system, several categories, rather than building a
// separate feature per icon type.
export const MARKER_TYPES = [
  { id: "room", label: "Room", icon: "🚪", color: "#2f6db0" },
  { id: "facility", label: "Facility", icon: "📍", color: "#2e7d46" },
  { id: "exit", label: "Emergency Exit", icon: "🚨", color: "#c62a2c" },
  { id: "hydrant", label: "Fire Hydrant / Extinguisher", icon: "🧯", color: "#b5701c" },
];

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
  return floor === -1 ? "UG" : `Floor ${floor}`;
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

export function suggestedPhotoFilename(id) {
  return id ? `${id}.jpg` : "";
}

// camelCase type ids (transitionExit, openArea) become snake_case for
// readability inside a generated ID — transitionExit -> transition_exit.
function typeToIdSlug(typeId) {
  return typeId.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

// Builds a { building }_f{ floor }_{ type }{ number } id and picks the next
// free number for that exact building+floor+type combination, so multiple
// hallways etc. on the same floor never collide. `excludeId` lets the caller
// leave a node's own current id out of the "already used" check (used when
// suggesting a rename for a node that already occupies its own slot).
export function suggestNodeId(building, floor, type, nodes, excludeId = null) {
  const prefix = `${building}_f${floor}_${typeToIdSlug(type)}`;
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
