import { TRANSITION_TYPES } from "./constants";

// Plans moving every node of one building into another: each node's id is
// re-prefixed (gd1_f2_hall01 -> gd12_f2_hall01, so it still passes
// validateNodeId) and its building field switched. Floors are kept as-is,
// so the target building must have every floor the nodes use.
//
// Returns { moves: [{ id, newId }], problems: [string] }. Nothing should be
// applied while `problems` is non-empty.
export function planBuildingMove(nodes, fromId, toId, targetFloors) {
  const moving = nodes.filter((n) => n.building === fromId);
  const movingIds = new Set(moving.map((n) => n.id));
  const takenIds = new Set(nodes.filter((n) => !movingIds.has(n.id)).map((n) => n.id));
  const problems = [];
  const moves = [];

  if (fromId === toId) {
    return { moves, problems: ["Pick a different building to move the nodes to."] };
  }

  for (const n of moving) {
    const newId = n.id.startsWith(`${fromId}_f`) ? toId + n.id.slice(fromId.length) : n.id;

    if (takenIds.has(newId)) {
      problems.push(`"${n.id}" would become "${newId}", which is already used.`);
    }
    takenIds.add(newId);

    if (!targetFloors.includes(Number(n.floor))) {
      problems.push(`"${n.id}" is on floor ${n.floor}, which the target building doesn't have.`);
    }
    // Only stairs/fire exits use leadsToFloors; other types can carry a
    // stray value that means nothing.
    if (TRANSITION_TYPES.includes(n.type)) {
      const missing = (n.leadsToFloors || []).map(Number).filter((f) => !targetFloors.includes(f));
      if (missing.length > 0) {
        problems.push(`"${n.id}" leads to floor(s) ${missing.join(", ")}, which the target building doesn't have.`);
      }
    }

    moves.push({ id: n.id, newId });
  }
  return { moves, problems };
}
