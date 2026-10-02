import { describe, it, expect } from "vitest";
import {
  SAVED_ROOMS_KEY,
  readSavedRooms,
  writeSavedRooms,
  isRoomSaved,
  toggleSavedRoom,
  resolveSavedRooms,
} from "./savedRooms";

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
    data,
  };
}

describe("readSavedRooms", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(readSavedRooms(memoryStorage())).toEqual([]);
  });

  it("returns an empty list for corrupt or non-array data", () => {
    expect(readSavedRooms(memoryStorage({ [SAVED_ROOMS_KEY]: "{not json" }))).toEqual([]);
    expect(readSavedRooms(memoryStorage({ [SAVED_ROOMS_KEY]: '{"a":1}' }))).toEqual([]);
  });

  it("drops entries that aren't non-blank strings", () => {
    const s = memoryStorage({ [SAVED_ROOMS_KEY]: JSON.stringify(["Room 1", 4, "  ", null]) });
    expect(readSavedRooms(s)).toEqual(["Room 1"]);
  });

  it("returns an empty list when storage throws or is missing", () => {
    const throwing = { getItem: () => { throw new Error("blocked"); } };
    expect(readSavedRooms(throwing)).toEqual([]);
    expect(readSavedRooms(null)).toEqual([]);
  });
});

describe("writeSavedRooms", () => {
  it("round-trips through readSavedRooms", () => {
    const s = memoryStorage();
    expect(writeSavedRooms(s, ["Room 2", "Room 1"])).toBe(true);
    expect(readSavedRooms(s)).toEqual(["Room 2", "Room 1"]);
  });

  it("reports failure instead of throwing when storage is full", () => {
    const full = { setItem: () => { throw new Error("QuotaExceededError"); } };
    expect(writeSavedRooms(full, ["Room 1"])).toBe(false);
  });
});

describe("toggleSavedRoom / isRoomSaved", () => {
  it("saves a new room at the front", () => {
    expect(toggleSavedRoom(["Room 1"], "Room 2")).toEqual(["Room 2", "Room 1"]);
  });

  it("unsaves a room regardless of case or spacing", () => {
    expect(toggleSavedRoom(["Room 2", "Room 1"], " room 2 ")).toEqual(["Room 1"]);
  });

  it("matches names case-insensitively", () => {
    expect(isRoomSaved(["Registrar"], "REGISTRAR")).toBe(true);
    expect(isRoomSaved(["Registrar"], "Library")).toBe(false);
  });

  it("ignores blank names", () => {
    expect(toggleSavedRoom(["Room 1"], "  ")).toEqual(["Room 1"]);
    expect(isRoomSaved(["Room 1"], "")).toBe(false);
  });
});

describe("resolveSavedRooms", () => {
  const rooms = [
    { roomName: "Room 1", node: { id: "a" } },
    { roomName: "Registrar", node: { id: "b" } },
  ];

  it("returns matching rooms in saved order", () => {
    expect(resolveSavedRooms(["registrar", "Room 1"], rooms).map((r) => r.roomName)).toEqual(["Registrar", "Room 1"]);
  });

  it("skips names that no longer match a room", () => {
    expect(resolveSavedRooms(["Old Name", "Room 1"], rooms).map((r) => r.roomName)).toEqual(["Room 1"]);
  });

  it("lists a room once even if saved under two spellings", () => {
    expect(resolveSavedRooms(["Room 1", "ROOM 1"], rooms)).toHaveLength(1);
  });
});
