import { allBuildingIds } from "./constants";

// Validates node IDs against the canonical format: {building}_f{floor}_{anything}
// e.g. gd1_f2_hallway03, gd2_f-1_transition01
// Floor can be negative (UG = -1), so the pattern allows an optional leading "-".
// The building segment isn't hardcoded to gd1/gd2/gd3 — it accepts any
// building id (built-in or admin-created via "+ New building"), since a
// slugified building id is always plain lowercase letters/digits with no
// underscores, so it can't be confused with the floor/label separators.
const ID_PATTERN = /^([a-z0-9]+)_f(-?\d+)_[a-z0-9_]+$/;

export function validateNodeId(id, building, floor) {
  const errors = [];

  if (!id || !id.trim()) {
    errors.push("ID cannot be empty.");
    return errors;
  }

  if (id !== id.toLowerCase()) {
    errors.push("ID must be lowercase.");
  }

  if (/\s/.test(id)) {
    errors.push("ID cannot contain spaces: use underscores.");
  }

  if (!ID_PATTERN.test(id)) {
    errors.push(
      `ID must match the pattern {building}_f{floor}_{label}, e.g. "${building || "gd1"}_f${floor ?? 1}_hallway03".`
    );
  } else {
    // Cross-check the ID's embedded building/floor actually match the selected fields,
    // so the ID can't silently drift from the structured data (the original bug).
    const match = id.match(/^([a-z0-9]+)_f(-?\d+)_/);
    if (match) {
      const [, idBuilding, idFloor] = match;
      if (building && idBuilding !== building) {
        errors.push(`ID says building "${idBuilding}" but selected building is "${building}".`);
      }
      if (floor !== undefined && floor !== null && Number(idFloor) !== Number(floor)) {
        errors.push(`ID says floor ${idFloor} but selected floor is ${floor}.`);
      }
      if (!allBuildingIds().includes(idBuilding)) {
        errors.push(`"${idBuilding}" isn't a known building. Check the building selector above.`);
      }
    }
  }

  return errors;
}

export function checkDuplicateId(id, existingNodes, editingId = null) {
  const dup = existingNodes.some((n) => n.id === id && n.id !== editingId);
  return dup ? [`A node with ID "${id}" already exists.`] : [];
}

// A room can only belong to one node — otherwise search ("where is room 203")
// would have no single answer. Case/whitespace-insensitive so "203" and " 203 "
// aren't treated as different rooms.
export function checkDuplicateRooms(rooms, existingNodes, editingId = null) {
  const errors = [];
  const normalize = (r) => r.trim().toLowerCase();
  const seenInThisNode = new Set();

  for (const room of rooms) {
    const key = normalize(room);
    if (!key) continue;

    if (seenInThisNode.has(key)) {
      errors.push(`Room "${room}" is listed twice on this node.`);
      continue;
    }
    seenInThisNode.add(key);

    const conflict = existingNodes.find(
      (n) => n.id !== editingId && (n.rooms || []).some((r) => normalize(r) === key)
    );
    if (conflict) {
      errors.push(`Room "${room}" is already assigned to "${conflict.name}" (${conflict.id}).`);
    }
  }
  return errors;
}

export function validateNode(node, existingNodes, editingId = null) {
  const errors = [
    ...validateNodeId(node.id, node.building, node.floor),
    ...checkDuplicateId(node.id, existingNodes, editingId),
    ...checkDuplicateRooms(node.rooms || [], existingNodes, editingId),
  ];

  if (!node.name || !node.name.trim()) {
    errors.push("Name cannot be empty.");
  }

  if (!node.building) {
    errors.push("Building is required.");
  }

  if (node.floor === undefined || node.floor === null || node.floor === "") {
    errors.push("Floor is required.");
  }

  if ((node.type === "transition" || node.type === "transitionExit") &&
      (!Array.isArray(node.leadsToFloors) || node.leadsToFloors.length === 0)) {
    errors.push("Stairs and Fire Exit nodes must specify at least one floor they lead to.");
  }

  return errors;
}
