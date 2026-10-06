import { describe, expect, it } from "vitest";
import {
  DEFAULT_DIRECTORY_SETTINGS as DEFAULTS,
  addRooms,
  clearBuilding,
  isRoomListed,
  listedRooms,
  removeRooms,
  sameDirectorySettings,
  setIncoming,
  toggleInList,
} from "./directorySettings";

const rooms = [{ roomName: "A" }, { roomName: "B" }, { roomName: "C" }];
const names = rooms.map((r) => r.roomName);
const names_of = (list) => list.map((r) => r.roomName);

describe("directorySettings", () => {
  it("toggles list entries without duplicating them", () => {
    expect(toggleInList(["gd1"], "gd2", true)).toEqual(["gd1", "gd2"]);
    expect(toggleInList(["gd1", "gd2"], "gd2", true)).toEqual(["gd1", "gd2"]);
    expect(toggleInList(["gd1", "gd2"], "gd1", false)).toEqual(["gd2"]);
  });

  it("lists every room for a building nobody has touched", () => {
    expect(listedRooms(DEFAULTS, "gd1", rooms)).toEqual(rooms);
  });

  it("clearing empties the building but incoming rooms still arrive", () => {
    const cleared = clearBuilding(DEFAULTS, "gd1", names);
    expect(listedRooms(cleared, "gd1", rooms)).toEqual([]);
    expect(isRoomListed(cleared, "gd1", "New Room")).toBe(true);
    expect(listedRooms(cleared, "gd2", rooms)).toEqual(rooms);
  });

  it("with incoming off, only added rooms are listed", () => {
    const s = addRooms(setIncoming(clearBuilding(DEFAULTS, "gd1", names), "gd1", false), "gd1", ["b"]);
    expect(names_of(listedRooms(s, "gd1", rooms))).toEqual(["B"]);
    expect(isRoomListed(s, "gd1", "New Room")).toBe(false);
  });

  it("adding and removing are case-insensitive and never duplicate", () => {
    let s = clearBuilding(DEFAULTS, "gd1", names);
    s = addRooms(s, "gd1", ["B", "c"]);
    s = addRooms(s, "gd1", ["b", "A"]);
    expect(s.buildingRooms.gd1.listed).toEqual(["B", "c", "A"]);
    s = removeRooms(s, "gd1", ["a"]);
    expect(names_of(listedRooms(s, "gd1", rooms))).toEqual(["B", "C"]);
  });

  it("flipping incoming loses neither list", () => {
    let s = addRooms(clearBuilding(DEFAULTS, "gd1", names), "gd1", ["A"]);
    s = setIncoming(setIncoming(s, "gd1", false), "gd1", true);
    expect(names_of(listedRooms(s, "gd1", rooms))).toEqual(["A"]);
  });

  it("compares settings regardless of list order, and treats no entry as the default", () => {
    const a = addRooms(clearBuilding(DEFAULTS, "gd1", names), "gd1", ["A", "B"]);
    const b = addRooms(clearBuilding(DEFAULTS, "gd1", [...names].reverse()), "gd1", ["B", "A"]);
    expect(sameDirectorySettings(a, b)).toBe(true);
    expect(sameDirectorySettings(a, DEFAULTS)).toBe(false);
    expect(sameDirectorySettings(setIncoming(DEFAULTS, "gd1", true), DEFAULTS)).toBe(true);
  });

  it("notices a change to which buildings start expanded", () => {
    expect(DEFAULTS.expandedBuildings).toEqual([]);
    expect(sameDirectorySettings({ ...DEFAULTS, expandedBuildings: ["gd1"] }, DEFAULTS)).toBe(false);
    expect(sameDirectorySettings({ ...DEFAULTS, expandedBuildings: [] }, DEFAULTS)).toBe(true);
  });
});
