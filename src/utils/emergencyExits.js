import { EMERGENCY_EXIT_MARKER, floorLabel } from "./constants";

// A fire exit node is any node carrying an emergency exit marker: the marker
// is placed where the fire stairwell door is in the panorama, and lists the
// landing nodes the hidden stairs come out at (`landings`, node ids). Landings
// are directed (the stairs are a way down FROM this node), used only by
// Nearest Exit routing: ordinary directions walk neighbor links and never
// take them. A marker with no landings is a fire door to the street, which is
// the way out itself (the node is ticked as an Emergency Exit Destination
// Point instead).

export function emergencyExitMarkers(node) {
  return (node?.markers || []).filter((m) => m.type === EMERGENCY_EXIT_MARKER);
}

export function isFireExitNode(node) {
  return emergencyExitMarkers(node).length > 0;
}

// fromId -> [{ toId, markerId }], in the order each marker lists them. A landing
// naming a node that does not exist is skipped (the audit reports it), and the
// same target listed by two markers counts once.
export function exitLandingEdges(nodes) {
  const ids = new Set(nodes.map((n) => n.id));
  const edges = new Map();
  for (const node of nodes) {
    const seen = new Set();
    for (const marker of emergencyExitMarkers(node)) {
      for (const toId of marker.landings || []) {
        if (toId === node.id || !ids.has(toId) || seen.has(toId)) continue;
        seen.add(toId);
        if (!edges.has(node.id)) edges.set(node.id, []);
        edges.get(node.id).push({ toId, markerId: marker.id });
      }
    }
  }
  return edges;
}

// If moving fromId -> toId is a trip down the hidden fire stairs, the marker to
// use at each end; otherwise null. `fromMarker` is the one on fromId that lists
// toId, so the panorama can highlight it. `toMarker` is the landing node's own
// emergency exit marker, if it has one (where the visitor steps out facing).
export function fireStairsBetween(nodes, fromId, toId) {
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const from = byId[fromId];
  const to = byId[toId];
  if (!from || !to || (from.neighbors || []).includes(toId)) return null;
  const fromMarker = emergencyExitMarkers(from).find((m) => (m.landings || []).includes(toId));
  if (!fromMarker) return null;
  return { fromMarker, toMarker: emergencyExitMarkers(to)[0] || null, toFloor: Number(to.floor), toNode: to };
}

// Stepping out of the stairwell: face away from the landing's own door, as an
// elevator arrival does.
export function arrivalYawFromExit(marker) {
  return ((Number(marker.yaw) || 0) + 180) % 360;
}

// The nodes a marker on `node` could list as landings, for the admin's picker:
// the same building, any other floor, lowest floor first. `query` filters by
// name or id.
export function landingCandidates(nodes, node, query = "") {
  const q = query.trim().toLowerCase();
  return nodes
    .filter((n) => n.id !== node.id && n.building === node.building && Number(n.floor) !== Number(node.floor))
    .filter((n) => !q || n.id.toLowerCase().includes(q) || (n.name || "").toLowerCase().includes(q))
    .sort((a, b) => Number(a.floor) - Number(b.floor) || a.name.localeCompare(b.name));
}

// The wording for a step down (or up) the hidden fire stairs, in one place so
// the button, the banner and the spoken line always agree. `step` is
// progress.nextFireStairs: { floor, goesDown }.
export function fireStairsAction(step) {
  return `Take Emergency Exit stairs ${step.goesDown ? "down" : "up"} to ${floorLabel(step.floor)}`;
}

export function fireStairsAnnouncement(step) {
  return `Emergency Exit stairs ahead. Take them ${step.goesDown ? "down" : "up"} to ${floorLabel(step.floor)}.`;
}

// What is wrong with the landings as authored, one entry per problem:
//   { nodeId, markerId, landingId, problem }
// problem: "missing" (no such node), "self", "building" (another building) or
// "floor" (the same floor, so it is not a way up or down).
export function landingProblems(nodes) {
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const out = [];
  for (const node of nodes) {
    for (const marker of emergencyExitMarkers(node)) {
      for (const landingId of marker.landings || []) {
        const landing = byId[landingId];
        let problem = null;
        if (!landing) problem = "missing";
        else if (landingId === node.id) problem = "self";
        else if (landing.building !== node.building) problem = "building";
        else if (Number(landing.floor) === Number(node.floor)) problem = "floor";
        if (problem) out.push({ nodeId: node.id, markerId: marker.id, landingId, problem });
      }
    }
  }
  return out;
}

// A node with emergency exit landings that also has an ordinary neighbor link to
// another floor: the hidden stairs would then be walkable by ordinary directions.
// Floors change through the marker's landings, or through a Stairs node.
export function fireExitCrossFloorLinks(nodes) {
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const out = [];
  for (const node of nodes) {
    if (!emergencyExitMarkers(node).some((m) => (m.landings || []).length > 0)) continue;
    for (const nbId of node.neighbors || []) {
      const nb = byId[nbId];
      if (nb && Number(nb.floor) !== Number(node.floor)) out.push({ nodeId: node.id, neighborId: nbId });
    }
  }
  return out;
}
