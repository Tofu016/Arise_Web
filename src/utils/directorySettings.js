// Which parts of the sidebar Directory visitors see.
//
// Campuses and buildings are stored as "hidden" lists, so one created later
// appears by default. A building's rooms are stored per building as
// { incoming, listed, removed }: the directory lists the `listed` rooms, and
// with `incoming` on it also lists every room not in `removed`, so rooms
// created later appear on their own. Both lists are kept whichever way
// `incoming` is set, so flipping it loses nothing. A building with no entry
// behaves as incoming on with nothing removed.
export const DEFAULT_DIRECTORY_SETTINGS = {
  showSaved: true,
  hiddenCampuses: [],
  hiddenBuildings: [],
  buildingRooms: {},
};

const DEFAULT_ENTRY = { incoming: true, listed: [], removed: [] };

// Room names match case-insensitively, the same way buildSearchableRooms
// dedupes them.
const nameKey = (name) => name.trim().toUpperCase();
const hasName = (list, name) => list.some((n) => nameKey(n) === nameKey(name));
const withoutNames = (list, names) => {
  const drop = new Set(names.map(nameKey));
  return list.filter((n) => !drop.has(nameKey(n)));
};
const withNames = (list, extra) => [...list, ...withoutNames(extra, list)];

// Every room/facility (from nodes' "Rooms served" lists, see
// buildSearchableRooms) in one building, in natural order ("Room 2" before
// "Room 10"). Rooms rather than nodes: a node is a panorama point, which
// means nothing to a visitor browsing for a destination.
export function roomsInBuilding(rooms, buildingId) {
  return (rooms || [])
    .filter((r) => r.node.building === buildingId)
    .sort((a, b) => a.roomName.localeCompare(b.roomName, undefined, { numeric: true, sensitivity: "base" }));
}

export function entryFor(settings, buildingId) {
  const entry = settings.buildingRooms[buildingId];
  return entry && Array.isArray(entry.listed) ? entry : DEFAULT_ENTRY;
}

export function isRoomListed(settings, buildingId, roomName) {
  const { incoming, listed, removed } = entryFor(settings, buildingId);
  return hasName(listed, roomName) || (incoming && !hasName(removed, roomName));
}

// The rooms a visitor's Directory lists for one building (`rooms` is that
// building's rooms, see roomsInBuilding).
export function listedRooms(settings, buildingId, rooms) {
  return rooms.filter((r) => isRoomListed(settings, buildingId, r.roomName));
}

function withEntry(settings, buildingId, patch) {
  const entry = { ...entryFor(settings, buildingId), ...patch };
  return { ...settings, buildingRooms: { ...settings.buildingRooms, [buildingId]: entry } };
}

export function addRooms(settings, buildingId, names) {
  const { listed, removed } = entryFor(settings, buildingId);
  return withEntry(settings, buildingId, { listed: withNames(listed, names), removed: withoutNames(removed, names) });
}

export function removeRooms(settings, buildingId, names) {
  const { listed, removed } = entryFor(settings, buildingId);
  return withEntry(settings, buildingId, { listed: withoutNames(listed, names), removed: withNames(removed, names) });
}

// Empties a building's directory. `allNames` is every room in the building
// now: with incoming on, those are what must stay out (rooms created later
// still come in).
export function clearBuilding(settings, buildingId, allNames) {
  return withEntry(settings, buildingId, { listed: [], removed: allNames });
}

export function setIncoming(settings, buildingId, incoming) {
  return withEntry(settings, buildingId, { incoming });
}

export function toggleInList(list, value, hidden) {
  const without = list.filter((v) => v !== value);
  return hidden ? [...without, value] : without;
}

export function sameDirectorySettings(a, b) {
  const sameList = (x, y) => x.length === y.length && x.every((v) => hasName(y, v));
  const sameEntry = (x, y) => x.incoming === y.incoming && sameList(x.listed, y.listed) && sameList(x.removed, y.removed);
  const ids = new Set([...Object.keys(a.buildingRooms), ...Object.keys(b.buildingRooms)]);
  return (
    a.showSaved === b.showSaved &&
    sameList(a.hiddenCampuses, b.hiddenCampuses) &&
    sameList(a.hiddenBuildings, b.hiddenBuildings) &&
    [...ids].every((id) => sameEntry(entryFor(a, id), entryFor(b, id)))
  );
}
