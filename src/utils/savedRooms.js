import { normalizeRoomName } from "./entities";

// Saved rooms live only in this browser's localStorage: no account needed,
// nothing sent to the API (SavedRooms_API is the mobile app's per-account
// list and is not used here). Rooms are saved by name, since room names are
// unique campus-wide and a room with no details record has no other id. The
// trade-off: renaming a room in the Room Editor drops it from everyone's
// saved list, as the old name no longer matches anything.
//
// Stored as a JSON array of room names, most recently saved first.
export const SAVED_ROOMS_KEY = "arise.savedRooms.v1";

// localStorage can be missing, full, or throw outright (private windows,
// blocked site data), so every access is guarded and falls back to "nothing
// saved" rather than breaking the room panel.
export function readSavedRooms(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(SAVED_ROOMS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((n) => typeof n === "string" && n.trim()) : [];
  } catch {
    return [];
  }
}

export function writeSavedRooms(storage, names) {
  try {
    storage?.setItem(SAVED_ROOMS_KEY, JSON.stringify(names));
    return true;
  } catch {
    return false;
  }
}

export function isRoomSaved(names, roomName) {
  const key = normalizeRoomName(roomName);
  return !!key && names.some((n) => normalizeRoomName(n) === key);
}

// Saving puts the room first; unsaving removes every spelling of it.
export function toggleSavedRoom(names, roomName) {
  const key = normalizeRoomName(roomName);
  if (!key) return names;
  const rest = names.filter((n) => normalizeRoomName(n) !== key);
  return rest.length === names.length ? [roomName.trim(), ...names] : rest;
}

// The saved names resolved against the directory's current rooms, in saved
// order. Names that no longer match a room (renamed or removed) are skipped.
export function resolveSavedRooms(names, rooms) {
  const byName = new Map((rooms || []).map((r) => [normalizeRoomName(r.roomName), r]));
  const out = [];
  for (const n of names) {
    const room = byName.get(normalizeRoomName(n));
    if (room && !out.includes(room)) out.push(room);
  }
  return out;
}
