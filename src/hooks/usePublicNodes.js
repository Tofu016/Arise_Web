import { useEffect, useState } from "react";
import { getNodes, getNodesError, subscribeNodes } from "../utils/nodeStore";

// Read-only view onto nodeStore's module-singleton cache, for MainPage.jsx,
// which has no CRUD needs. Shares useNodes's mapping (utils/entities.js).
// No live subscription to the backend — reload-to-see-updates is the
// accepted trade-off, so an admin's edit won't appear to an already-open
// visitor without a refresh.
//
// `nodes` is null while loading (MainPage relies on that), and `error`
// carries the message if the load failed. The fetch itself started at
// nodeStore's module load, not on this hook's mount, so it's already
// in flight (in parallel with buildingStore's own fetch) by the time
// MainPage renders.

export function usePublicNodes() {
  const [, setTick] = useState(0);
  useEffect(() => subscribeNodes(() => setTick((t) => t + 1)), []);
  return { nodes: getNodes(), error: getNodesError() };
}
