import { useCallback, useSyncExternalStore } from "react";
import { readSavedRooms, writeSavedRooms, isRoomSaved, toggleSavedRoom, SAVED_ROOMS_KEY } from "../utils/savedRooms";

// The visitor's saved rooms (see utils/savedRooms.js for why they live in
// localStorage). An external store rather than component state so the room
// panel's save button and the directory's "Saved Directories" group stay in
// step, and so saving in one tab shows up in the others (the `storage`
// event only fires in the tabs that didn't make the change).

const listeners = new Set();
let snapshot = null;

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function getSnapshot() {
  if (snapshot === null) snapshot = readSavedRooms(storage());
  return snapshot;
}

function setSnapshot(next) {
  snapshot = next;
  for (const l of listeners) l();
}

function onStorage(e) {
  if (e.key === SAVED_ROOMS_KEY || e.key === null) setSnapshot(readSavedRooms(storage()));
}

function subscribe(listener) {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

export function useSavedRooms() {
  const savedNames = useSyncExternalStore(subscribe, getSnapshot);

  const isSaved = useCallback((roomName) => isRoomSaved(savedNames, roomName), [savedNames]);

  // Updates this tab even if the write fails (storage full or blocked), so
  // the button still responds; it just won't survive a reload.
  const toggleSaved = useCallback((roomName) => {
    const next = toggleSavedRoom(getSnapshot(), roomName);
    writeSavedRooms(storage(), next);
    setSnapshot(next);
  }, []);

  return { savedNames, isSaved, toggleSaved };
}
