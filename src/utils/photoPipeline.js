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

// A second hop, but only past priorityId (the node the visitor is actively
// headed toward, e.g. the next stop on a resolved route) — never fanned out
// across every hotspot's own neighbors, which would grow exponentially and
// blow past photoStore's idle cache for branches the visitor likely won't
// take. With no priorityId there's no directional signal to bet on, so this
// yields nothing rather than guessing a branch. `nextNeighbors` is the
// priority node's own hotspot list; its own current-facing and back-facing
// links (currentId, priorityId itself) are excluded.
export const SECOND_HOP_LIMIT = 2;

export function planSecondHopPrefetch(nextNeighbors, { currentId, priorityId, limit = SECOND_HOP_LIMIT } = {}) {
  if (!priorityId) return [];
  return nextNeighbors
    .filter((h) => h.photo && h.id !== currentId && h.id !== priorityId)
    .slice(0, limit)
    .map((h) => h.photo);
}

// The first-load splash latch: true once the node list is in and the current
// photo is paintable, and never false again — later moves have their own,
// much smaller loading indicator and must not bring the splash back.
export function nextFirstLoadDone(done, { nodesLoaded, photoReady }) {
  return done || (!!nodesLoaded && !!photoReady);
}
