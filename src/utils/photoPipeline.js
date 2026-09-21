// Pure decisions behind the visitor's photo loading (see hooks/useNodePhoto.js).

// Capped at photoStore's idle cache size, so warming neighbors never evicts
// each other.
export const PREFETCH_LIMIT = 6;

// Which neighbor photos to warm, in order: the next stop on an active route
// first, then the rest in hotspot order. Hotspots with no photo, or leading
// back to the current node, are skipped.
export function planPrefetch(neighbors, { currentId, priorityId, limit = PREFETCH_LIMIT } = {}) {
  return neighbors
    .filter((h) => h.photo && h.id !== currentId)
    .sort((a, b) => (b.id === priorityId) - (a.id === priorityId))
    .slice(0, limit)
    .map((h) => h.photo);
}

// The first-load splash latch: true once the node list is in and the current
// photo is paintable, and never false again — later moves have their own,
// much smaller loading indicator and must not bring the splash back.
export function nextFirstLoadDone(done, { nodesLoaded, photoReady }) {
  return done || (!!nodesLoaded && !!photoReady);
}
