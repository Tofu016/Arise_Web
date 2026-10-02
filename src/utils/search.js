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
// description/department text — e.g. searching "registrar" finds a room
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

    const { roomDescription, department } = r.placard || {};
    const shortText = [department].filter(Boolean);
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

// Rooms with actual detail records (photo/description/department) —
// built by matching each node's "Rooms served" entries against the
// placard dialogs. Only rooms an admin has gone through Room Edit for are
// searchable; a room existing on a node alone isn't enough, since there'd
// be nothing to show on its card. Deduped case-insensitively.
// `includeWithoutDetails` keeps rooms with no record too, with a null
// placard: the desktop sidebar has a "No information." state for them and
// the kiosk card just shows the name and location.
export function buildSearchableRooms(nodes, getForRoom, { includeWithoutDetails = false } = {}) {
  if (!nodes) return [];
  const out = [];
  const seen = new Set();
  for (const n of nodes) {
    for (const roomName of n.rooms || []) {
      const key = roomName.trim().toUpperCase();
      if (seen.has(key)) continue;
      const placard = getForRoom(roomName) || null;
      if (!placard && !includeWithoutDetails) continue; // no detail record yet, not searchable here
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

function shuffle(items, random) {
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

// A "don't know what to search for" starting point: a random sample of
// searchable rooms. `random` is injectable so tests can pin the shuffle.
export function pickSuggestions(searchableRooms, count = 6, random = Math.random) {
  return shuffle(searchableRooms, random).slice(0, count);
}

// The empty-state counterpart to searchCampus: rooms first (same pool as
// pickSuggestions), then plain nodes filling whatever's left, the same
// "rooms first, places second, no duplicates" shape searchCampus returns
// once there's a query. Without this, an admin who hasn't gone through
// Room Edit for any room yet (no placardDialogs records, so
// buildSearchableRooms comes up empty) would see zero suggestions on an
// empty search box, even though typing a letter finds plenty of plain
// node/place matches — this keeps the empty state drawing from the same
// breadth of data typing does, instead of the narrower rooms-only pool.
export function pickLocationSuggestions(nodes, searchableRooms, count = 6, random = Math.random) {
  const rooms = pickSuggestions(searchableRooms, count, random);
  const remaining = count - rooms.length;
  if (remaining <= 0 || !nodes) return { rooms, places: [] };
  const roomNodeIds = new Set(rooms.map((r) => r.node.id));
  const placePool = nodes.filter((n) => !roomNodeIds.has(n.id));
  return { rooms, places: shuffle(placePool, random).slice(0, remaining) };
}

// A "room" marker's label is a separate, independently-typed field from a
// node's "Rooms served" list, so it's matched by name, case/space/punctuation
// insensitive. Undefined when no saved room details exist for the label.
export function findRoomForMarker(marker, searchableRooms) {
  const key = normalize(marker.label);
  if (!key) return undefined;
  return searchableRooms.find((r) => normalize(r.roomName) === key);
}

// The other direction: the "room" marker on a node that stands for a room,
// matched by the same name rule. Used to face that marker when a room is
// jumped to. Undefined when the node has no marker for it.
export function findMarkerForRoom(node, roomName) {
  const key = normalize(roomName);
  if (!key) return undefined;
  return (node?.markers || []).find((m) => m.type === "room" && normalize(m.label) === key);
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

// The admin node lists' search: every node whose ID, name or any "Rooms
// served" entry matches, best match first (identical, then starts-with,
// then contains, then typo-tolerant), keeping list order within a tier.
// Unlike searchNodes it never truncates, since the admin list IS the
// result set, and it matches IDs too, which is how admins refer to nodes.
// A blank query leaves the list as it was.
export function rankNodeMatches(query, nodes) {
  const q = normalize(query);
  if (!q) return nodes;
  return rankBy(nodes, (n) => {
    const score = bestScore(q, [n.id, n.name, ...(n.rooms || [])]);
    return score === Infinity ? null : { group: GROUP_EXACT, score };
  });
}

// Every "Rooms served" entry on every node, with or without saved details,
// for the Room Editor's Rooms list. Unlike buildSearchableRooms it never
// dedupes: if two nodes do list the same name, both need to be reachable
// to fix that, so each entry is keyed by its node too (see roomKey).
export function listAllRooms(nodes, getForRoom) {
  const out = [];
  for (const node of nodes || []) {
    for (const roomName of node.rooms || []) {
      out.push({ roomName, node, placard: getForRoom(roomName) || null });
    }
  }
  return out;
}

export const roomKey = (nodeId, roomName) => `${nodeId}::${roomName}`;

// The Room Editor's Rooms list search. Same tiers as searchRooms (room
// name, then department/description text, then typo-tolerant), with the
// room's node ID and name also counted as text so typing a node still
// lists the rooms on it. Never truncates; a blank query keeps list order.
export function rankRoomMatches(query, rooms) {
  const q = normalize(query);
  if (!q) return rooms;
  return rankBy(rooms, (r) => {
    const nameScore = matchScore(q, r.roomName);
    if (nameScore === 0) return { group: GROUP_EXACT, score: 0 };
    if (nameScore < 30) return { group: GROUP_PARTIAL, score: nameScore };

    const { roomDescription, department } = r.placard || {};
    const shortText = [department, r.node?.id, r.node?.name].filter(Boolean);
    const textScore = Math.min(
      bestScore(q, shortText, { fuzzy: false }),
      matchScore(q, roomDescription, { fuzzy: false })
    );
    if (textScore < Infinity) return { group: GROUP_TEXT, score: textScore };

    const fuzzy = Math.min(nameScore, bestScore(q, shortText));
    if (isFuzzyScore(fuzzy)) return { group: GROUP_FUZZY, score: fuzzy };
    return null;
  });
}
