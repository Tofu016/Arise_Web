import { MIN_ELEVATOR_FLOORS } from "./constants";

// An elevator is one `elevators` row (id, label, building, accessibleFloors
// — the floors the car actually stops at; restricted floors are left out)
// plus one landing marker per floor, placed on the node where that floor's
// elevator doors are. A landing marker only stores which elevator it
// belongs to (`elevatorId`); the floor list and label it carries on the
// client are read-time copies joined from that one row by the backend, so
// two landings of the same elevator can never disagree.
//
// Landings of the same elevator are connected to each other for routing
// (see pathfinding.js), and clicking one in the viewer rides to another.

// elevatorId -> every landing of it, as { nodeId, floor, marker }.
export function landingsByElevator(nodes) {
  const groups = new Map();
  for (const node of nodes || []) {
    for (const marker of node.markers || []) {
      if (marker.type !== "elevator" || !marker.elevatorId) continue;
      if (!groups.has(marker.elevatorId)) groups.set(marker.elevatorId, []);
      groups.get(marker.elevatorId).push({ nodeId: node.id, floor: Number(node.floor), marker });
    }
  }
  return groups;
}

// Every pair of landings of the same elevator, both on floors the elevator
// serves. The accessibility check is defensive only — the backend refuses
// a landing on a floor the elevator doesn't serve, and refuses dropping a
// floor that still has one.
export function elevatorEdges(nodes) {
  const edges = [];
  for (const [elevatorId, landings] of landingsByElevator(nodes)) {
    const served = landings.filter((l) => l.marker.accessibleFloors.includes(l.floor));
    for (let i = 0; i < served.length; i++) {
      for (let j = i + 1; j < served.length; j++) {
        if (served[i].nodeId === served[j].nodeId || served[i].floor === served[j].floor) continue;
        edges.push({ a: served[i].nodeId, b: served[j].nodeId, elevatorId });
      }
    }
  }
  return edges;
}

export function elevatorAdjacency(nodes) {
  const adjacency = new Map();
  for (const { a, b } of elevatorEdges(nodes)) {
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a).add(b);
    adjacency.get(b).add(a);
  }
  return adjacency;
}

// The landings reachable by riding elevator `elevatorId` from `nodeId`,
// lowest floor first: [{ node, floor, marker }]. `marker` is the landing
// marker on the destination node.
export function elevatorDestinationsFrom(nodes, nodeId, elevatorId) {
  const byId = Object.fromEntries((nodes || []).map((n) => [n.id, n]));
  const landings = landingsByElevator(nodes).get(elevatorId) || [];
  if (!landings.some((l) => l.nodeId === nodeId)) return [];
  return elevatorEdges(nodes)
    .filter((e) => e.elevatorId === elevatorId && (e.a === nodeId || e.b === nodeId))
    .map((e) => (e.a === nodeId ? e.b : e.a))
    .map((id) => landings.find((l) => l.nodeId === id))
    .filter((l) => l && byId[l.nodeId])
    .map((l) => ({ node: byId[l.nodeId], floor: l.floor, marker: l.marker }))
    .sort((a, b) => a.floor - b.floor);
}

// If moving fromId -> toId is an elevator ride, the landing marker to use
// on each end; otherwise null. Used to turn a route step into "take the
// elevator" instead of "walk through this hotspot".
export function elevatorRideBetween(nodes, fromId, toId) {
  const edge = elevatorEdges(nodes).find(
    (e) => (e.a === fromId && e.b === toId) || (e.a === toId && e.b === fromId)
  );
  if (!edge) return null;
  const landings = landingsByElevator(nodes).get(edge.elevatorId);
  const from = landings.find((l) => l.nodeId === fromId);
  const to = landings.find((l) => l.nodeId === toId);
  return { elevatorId: edge.elevatorId, fromMarker: from.marker, toMarker: to.marker, toFloor: to.floor };
}

// Stepping out of the car: arrive facing away from the destination
// landing's doors (its marker), toward the floor itself.
export function arrivalYawFromLanding(marker) {
  return ((Number(marker.yaw) || 0) + 180) % 360;
}

// Admin validation for creating or editing the elevator record itself.
export function validateElevator({ id, label, building, accessibleFloors }, { buildingFloors, existingIds = [], isNew }) {
  const errors = [];
  if (isNew) {
    if (!id?.trim()) errors.push("Elevator ID is required.");
    else if (existingIds.includes(id.trim())) errors.push(`Elevator ID "${id.trim()}" is already used.`);
  }
  if (!label?.trim()) errors.push("A label is required, e.g. \"Elevator A\".");
  if (!building) errors.push("Pick a building.");
  const floors = accessibleFloors || [];
  if (floors.length < MIN_ELEVATOR_FLOORS) {
    errors.push(`Pick at least ${MIN_ELEVATOR_FLOORS} floors — a single-floor elevator can't take anyone anywhere.`);
  }
  const invalid = floors.filter((f) => !buildingFloors.includes(f));
  if (invalid.length > 0) errors.push(`This building doesn't have floor(s): ${invalid.join(", ")}.`);
  return errors;
}

// Floors an elevator edit would drop while a landing still sits there —
// the backend refuses those, so the form says why before sending.
export function floorsWithLandingsDropped(elevator, nextFloors) {
  return (elevator.landings || []).filter((l) => !nextFloors.includes(l.floor));
}

// Admin validation for placing a landing of `elevator` on `node`.
export function validateElevatorLanding(elevator, node) {
  if (!elevator) return ["Pick an elevator."];
  const errors = [];
  if (elevator.building !== node.building) errors.push("That elevator belongs to a different building.");
  if (!elevator.accessibleFloors.includes(Number(node.floor))) {
    errors.push("That elevator doesn't stop on this node's floor — add the floor to the elevator first.");
  }
  const clash = (elevator.landings || []).find((l) => l.floor === Number(node.floor));
  if (clash) {
    errors.push(
      clash.nodeId === node.id
        ? "This node already has a landing for that elevator."
        : `That elevator already has a landing on this floor (node "${clash.nodeId}").`
    );
  }
  return errors;
}
