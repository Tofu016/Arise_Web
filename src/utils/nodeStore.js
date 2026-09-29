import { apiGet } from "./apiClient";
import { toNode } from "./entities";

// Module-singleton cache for the public node graph, mirroring
// buildingStore.js's pattern: fetches once at module load (so it starts in
// parallel with buildingStore's own fetch, before MainPage even mounts)
// and is shared across every usePublicNodes() consumer/remount within the
// session, rather than each mount firing its own Nodes_API/getAll. No live
// subscription — reload-to-see-updates, the same trade-off usePublicNodes
// already accepted.

let nodes = null; // null while loading, matches usePublicNodes's old contract
let error = null;
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn());
}

async function refresh() {
  try {
    const data = await apiGet("Nodes_API/getAll");
    nodes = data.nodes.map(toNode);
    error = null;
  } catch (err) {
    error = err.message;
  }
  notify();
}

// Fire-and-forget on module load, same timing as buildingStore's refresh().
refresh();

export function getNodes() {
  return nodes;
}

export function getNodesError() {
  return error;
}

export function subscribeNodes(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
