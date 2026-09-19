import { apiGet } from "../utils/apiClient";
import { toNode } from "../utils/entities";
import { useCollection } from "./useCollection";

// Read-only Nodes_API hook for MainPage.jsx, which has no CRUD needs.
// Shares useNodes's mapping (utils/entities.js). No live subscription —
// reload-to-see-updates is the accepted trade-off, so an admin's edit
// won't appear to an already-open visitor without a refresh.
//
// `nodes` is null while loading (MainPage relies on that), and `error`
// carries the message if the load failed.

async function loadAll() {
  const data = await apiGet("Nodes_API/getAll");
  return data.nodes.map(toNode);
}

export function usePublicNodes() {
  const { items, error } = useCollection(loadAll, null);
  return { nodes: items, error };
}
