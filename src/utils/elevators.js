import { MIN_ELEVATOR_FLOORS } from "./constants";

// An elevator marker is unlike every other marker type: instead of just
// labeling something visible from where you're standing, it carries the
// data needed to treat two DIFFERENT nodes (on different floors, maybe
// different buildings) as connected — the same physical elevator, riding
// on a shared `elevatorGroupId` string every one of its landing markers
// repeats, plus each marker's own `accessibleFloors` (the floors that car
// actually stops at; real elevators skip restricted floors, so this is
// deliberately not "every floor in the building").
//
// There's no separate "elevators" table backing this — elevatorGroupId and
// accessibleFloors are just columns on each node_markers row (see
// entities.js's toMarker), duplicated across every landing of the same
// elevator. Nothing keeps those copies in sync with each other if an admin
// edits one landing's floor list and not its siblings — see
// elevatorGroupWarnings below, which surfaces exactly that drift rather
// than silently trusting one copy.

// Every elevator marker in the graph, as { groupId, nodeId, floor, marker }.
function allElevatorLandings(nodes) {
  const landings = [];
  for (const node of nodes) {
    for (const marker of node.markers || []) {
      if (marker.type !== "elevator" || !marker.elevatorGroupId) continue;
      landings.push({ groupId: marker.elevatorGroupId, nodeId: node.id, floor: node.floor, marker });
    }
  }
  return landings;
}

// groupId -> every landing that claims to belong to it.
export function groupElevatorLandings(nodes) {
  const groups = new Map();
  for (const landing of allElevatorLandings(nodes)) {
    if (!groups.has(landing.groupId)) groups.set(landing.groupId, []);
    groups.get(landing.groupId).push(landing);
  }
  return groups;
}

// The bidirectional "you can ride this elevator between these two nodes"
// edges: every distinct pair of landings sharing a groupId, where EACH
// side's own accessibleFloors actually lists the other side's floor.
// Checking both directions (rather than trusting one shared list) means a
// drifted pair of landings — see the module comment — degrades to "no
// connection" instead of a connection only one side agreed to.
export function elevatorEdges(nodes) {
  const groups = groupElevatorLandings(nodes);
  const edges = [];
  for (const landings of groups.values()) {
    for (let i = 0; i < landings.length; i++) {
      for (let j = i + 1; j < landings.length; j++) {
        const a = landings[i];
        const b = landings[j];
        if (a.nodeId === b.nodeId) continue;
        if (a.marker.accessibleFloors.includes(b.floor) && b.marker.accessibleFloors.includes(a.floor)) {
          edges.push({ a: a.nodeId, b: b.nodeId, groupId: a.groupId });
        }
      }
    }
  }
  return edges;
}

// Adjacency map built from elevatorEdges, for pathfinding.js.
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

// Where riding the elevator FROM this one node can actually take you —
// used by the public viewer when an elevator marker is clicked: one result
// means "just go", more than one means "ask which floor". Scoped to a
// single groupId when given (a node could in principle host more than one
// distinct elevator's landing), otherwise every elevator reachable from
// this node.
export function elevatorDestinationsFrom(nodes, nodeId, groupId = null) {
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const edges = elevatorEdges(nodes).filter(
    (e) => (e.a === nodeId || e.b === nodeId) && (!groupId || e.groupId === groupId)
  );
  const destIds = new Set(edges.map((e) => (e.a === nodeId ? e.b : e.a)));
  return [...destIds].map((id) => byId[id]).filter(Boolean);
}

// Data-quality check, surfaced in the admin UI rather than pathfinding:
// every landing in a group should agree on which floors the elevator
// serves (it's the same physical car) — flags a group where they don't,
// since silently trusting whichever landing you're editing would let two
// landings quietly disagree about a floor without either admin noticing.
export function elevatorGroupWarnings(nodes) {
  const groups = groupElevatorLandings(nodes);
  const warnings = [];
  for (const [groupId, landings] of groups) {
    const signatures = new Set(landings.map((l) => [...l.marker.accessibleFloors].sort((a, b) => a - b).join(",")));
    if (signatures.size > 1) {
      warnings.push({ groupId, nodeIds: landings.map((l) => l.nodeId) });
    }
  }
  return warnings;
}

// Admin-form validation for an elevator marker draft, before it's saved.
// `floorsForThisBuilding` is the building's real floor list (BUILDING_FLOORS
// et al in constants.js) — accessibleFloors can't name a floor the building
// doesn't have.
export function validateElevatorMarker({ elevatorGroupId, accessibleFloors, floor }, floorsForThisBuilding) {
  const errors = [];
  if (!elevatorGroupId || !elevatorGroupId.trim()) {
    errors.push("Elevator ID is required — use the same ID on every floor this elevator serves.");
  }
  const floors = accessibleFloors || [];
  if (floors.length < MIN_ELEVATOR_FLOORS) {
    errors.push(`Pick at least ${MIN_ELEVATOR_FLOORS} accessible floors — a single-floor elevator can't connect anywhere.`);
  }
  if (!floors.includes(floor)) {
    errors.push("Accessible floors must include this node's own floor — otherwise this landing can never be ridden away from.");
  }
  const invalid = floors.filter((f) => !floorsForThisBuilding.includes(f));
  if (invalid.length > 0) {
    errors.push(`This building doesn't have floor(s): ${invalid.join(", ")}.`);
  }
  return errors;
}
