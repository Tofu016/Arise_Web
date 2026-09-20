import { normalize, matchScore, bestScore, isFuzzyScore } from "./fuzzy";

// How results are grouped, best first. Within a group, a lower match score
// (see fuzzy.js) comes first, then the original order.
const GROUP_EXACT = 0;
const GROUP_PARTIAL = 1;
const GROUP_TEXT = 2;
const GROUP_FUZZY = 3;

function rankBy(items, classify) {
  const ranked = [];
  for (const item of items) {
    const result = classify(item);
    if (result) ranked.push({ item, ...result });
  }
  // Array.prototype.sort is stable, so ties keep their original order.
  ranked.sort((a, b) => a.group - b.group || a.score - b.score);
  return ranked.map((r) => r.item);
}

// Ranks results so an exact room match ("203") always beats a partial one
// ("203" matching "2033"), and a room match always beats a name match — since
// this is primarily meant for "type a room number, get directed there."
// Forgiving about case, spaces and punctuation, and — for letters-only
// queries — about a typo or two; those close-but-not-quite matches come last.
export function searchNodes(query, nodes) {
  const q = normalize(query);
  if (!q) return [];

  return rankBy(nodes, (n) => {
    const roomScore = bestScore(q, n.rooms || []);
    const nameScore = matchScore(q, n.name);
    if (roomScore === 0) return { group: GROUP_EXACT, score: 0 };
    if (roomScore < 30) return { group: GROUP_PARTIAL, score: roomScore };
    if (nameScore < 30) return { group: GROUP_TEXT, score: nameScore };
    const fuzzy = Math.min(roomScore, nameScore);
    if (isFuzzyScore(fuzzy)) return { group: GROUP_FUZZY, score: fuzzy };
    return null;
  }).slice(0, 8);
}

// Ranks room results with the same priority pattern as searchNodes: exact
// room name first, then partial name, then a hit somewhere in the room's
// description/department/use text — e.g. searching "registrar" finds a room
// whose Department is "Registrar's Office" even with no name match at all —
// then the typo-tolerant matches. The long description is only ever matched
// exactly; typos are forgiven in the short fields only.
// `searchableRooms` is [{ roomName, node, placard }] — only rooms that
// already have a placardDialogs record (see MainPage.jsx).
export function searchRooms(query, searchableRooms) {
  const q = normalize(query);
  if (!q) return [];

  return rankBy(searchableRooms, (r) => {
    const nameScore = matchScore(q, r.roomName);
    if (nameScore === 0) return { group: GROUP_EXACT, score: 0 };
    if (nameScore < 30) return { group: GROUP_PARTIAL, score: nameScore };

    const { roomDescription, department, use } = r.placard;
    const shortText = [department, use].filter(Boolean);
    const textScore = Math.min(
      bestScore(q, shortText, { fuzzy: false }),
      matchScore(q, roomDescription, { fuzzy: false })
    );
    if (textScore < Infinity) return { group: GROUP_TEXT, score: textScore };

    const fuzzy = Math.min(nameScore, bestScore(q, shortText));
    if (isFuzzyScore(fuzzy)) return { group: GROUP_FUZZY, score: fuzzy };
    return null;
  }).slice(0, 8);
}

// Rooms with actual detail records (photo/description/department/use) —
// built by matching each node's "Rooms served" entries against the
// placard dialogs. Only rooms an admin has gone through Room Edit for are
// searchable; a room existing on a node alone isn't enough, since there'd
// be nothing to show on its card. Deduped case-insensitively.
export function buildSearchableRooms(nodes, getForRoom) {
  if (!nodes) return [];
  const out = [];
  const seen = new Set();
  for (const n of nodes) {
    for (const roomName of n.rooms || []) {
      const key = roomName.trim().toUpperCase();
      if (seen.has(key)) continue;
      const placard = getForRoom(roomName);
      if (!placard) continue; // no detail record yet — not searchable here
      seen.add(key);
      out.push({ roomName, node: n, placard });
    }
  }
  return out;
}

// Rooms first, then plain node-name matches (entrances, hallways, ...) as
// a fallback so "Main Entrance" still works, not just room numbers. A node
// already surfaced through a room result is left out of the places, so
// the same location never shows twice. Always scans the whole campus.
export function searchCampus(query, nodes, searchableRooms) {
  const roomResults = searchRooms(query, searchableRooms);
  if (!nodes || !normalize(query)) return { roomResults, placeResults: [] };
  const roomNodeIds = new Set(roomResults.map((r) => r.node.id));
  return { roomResults, placeResults: searchNodes(query, nodes).filter((n) => !roomNodeIds.has(n.id)) };
}

// A "don't know what to search for" starting point: a random sample of
// searchable rooms. `random` is injectable so tests can pin the shuffle.
export function pickSuggestions(searchableRooms, count = 6, random = Math.random) {
  const pool = [...searchableRooms];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

// A "room" marker's label is a separate, independently-typed field from a
// node's "Rooms served" list, so it's matched by name, case/space/punctuation
// insensitive. Undefined when no saved room details exist for the label.
export function findRoomForMarker(marker, searchableRooms) {
  const key = normalize(marker.label);
  if (!key) return undefined;
  return searchableRooms.find((r) => normalize(r.roomName) === key);
}

// Resolves typed text to a node by EXACT name (case/space/punctuation-
// insensitive): node names first, then room names (a room's navigable
// target is its node). Deliberately no typo tolerance — a wrong guess here
// would send someone to the wrong place; the suggestions list is where
// fuzzy matches are offered, for the visitor to pick.
export function resolveExactNodeMatch(query, nodes, searchableRooms) {
  const q = normalize(query);
  if (!q || !nodes) return null;
  const nodeMatch = nodes.find((n) => normalize(n.name) === q);
  if (nodeMatch) return nodeMatch;
  const roomMatch = searchableRooms.find((r) => normalize(r.roomName) === q);
  return roomMatch ? roomMatch.node : null;
}
