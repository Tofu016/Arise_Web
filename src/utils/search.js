// Ranks results so an exact room match ("203") always beats a partial one
// ("203" matching "2033"), and a room match always beats a name match — since
// this is primarily meant for "type a room number, get directed there."
export function searchNodes(query, nodes) {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const exactRoom = [];
  const partialRoom = [];
  const nameMatch = [];

  for (const n of nodes) {
    const rooms = n.rooms || [];
    const roomExact = rooms.some((r) => r.trim().toLowerCase() === q);
    const roomPartial = !roomExact && rooms.some((r) => r.toLowerCase().includes(q));
    const nameHit = n.name.toLowerCase().includes(q);

    if (roomExact) exactRoom.push(n);
    else if (roomPartial) partialRoom.push(n);
    else if (nameHit) nameMatch.push(n);
  }

  return [...exactRoom, ...partialRoom, ...nameMatch].slice(0, 8);
}

// Ranks room results with the same priority pattern as searchNodes: exact
// room name first, then partial name, then a hit somewhere in the room's
// description/department/use text — e.g. searching "registrar" finds a room
// whose Department is "Registrar's Office" even with no name match at all.
// `searchableRooms` is [{ roomName, node, placard }] — only rooms that
// already have a placardDialogs record (see MainPage.jsx).
export function searchRooms(query, searchableRooms) {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const exact = [];
  const partial = [];
  const textMatch = [];

  for (const r of searchableRooms) {
    const name = r.roomName.toLowerCase();
    const isExact = name === q;
    const isPartial = !isExact && name.includes(q);
    const text = [r.placard.roomDescription, r.placard.department, r.placard.use]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const isTextHit = !isExact && !isPartial && text.includes(q);

    if (isExact) exact.push(r);
    else if (isPartial) partial.push(r);
    else if (isTextHit) textMatch.push(r);
  }

  return [...exact, ...partial, ...textMatch].slice(0, 8);
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
  if (!nodes || !query.trim()) return { roomResults, placeResults: [] };
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
// node's "Rooms served" list, so it's matched by name, case/whitespace
// insensitive. Undefined when no saved room details exist for the label.
export function findRoomForMarker(marker, searchableRooms) {
  const key = (marker.label || "").trim().toUpperCase();
  return searchableRooms.find((r) => r.roomName.trim().toUpperCase() === key);
}

// Resolves typed text to a node by EXACT name (case/whitespace-
// insensitive): node names first, then room names (a room's navigable
// target is its node). Deliberately not fuzzy — an ambiguous partial match
// could resolve to the wrong node.
export function resolveExactNodeMatch(query, nodes, searchableRooms) {
  const q = (query || "").trim().toLowerCase();
  if (!q || !nodes) return null;
  const nodeMatch = nodes.find((n) => n.name.trim().toLowerCase() === q);
  if (nodeMatch) return nodeMatch;
  const roomMatch = searchableRooms.find((r) => r.roomName.trim().toLowerCase() === q);
  return roomMatch ? roomMatch.node : null;
}
