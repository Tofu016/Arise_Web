import { describe, it, expect } from "vitest";
import { matchRoomsFromOcr } from "./ocrRoomMatch";
import { generateOcrTerms } from "./ocrTerms";

function room(roomName, placardName = roomName, extra = []) {
  return {
    roomName,
    node: { id: roomName },
    placard: { ocrEnabled: true, placardName, ocrSearchTerms: [...generateOcrTerms(placardName), ...extra] },
  };
}

const GD101 = room("GD1-101");
const GD102 = room("GD1-102");
const DEAN = room("Office of the Dean", "Dean's Office");
const CAFE = room("Café");
const ROOMS = [GD101, GD102, DEAN, CAFE];

const names = (matches) => matches.map((m) => m.room.roomName);

describe("matchRoomsFromOcr", () => {
  it("opens the room whose term the whole read is", () => {
    const [top] = matchRoomsFromOcr("GD1-101", ROOMS);
    expect(top).toMatchObject({ room: GD101, score: 1, matchesTerm: true, isExact: true });
  });

  it("ignores case, spacing and the dash character OCR returned", () => {
    for (const read of ["gd1-101", " GD1 - 101 ", "GD1–101", "GD1—101"]) {
      expect(matchRoomsFromOcr(read, ROOMS)[0].isExact).toBe(true);
    }
  });

  it("still opens the room when OCR dropped the dash", () => {
    expect(matchRoomsFromOcr("GD1101", ROOMS)[0]).toMatchObject({ room: GD101, isExact: true });
    expect(matchRoomsFromOcr("GD1 101", ROOMS)[0]).toMatchObject({ room: GD101, isExact: true });
  });

  it("matches the Placard name, not the room name", () => {
    expect(matchRoomsFromOcr("DEAN'S OFFICE", ROOMS)[0]).toMatchObject({ room: DEAN, isExact: true });
    expect(matchRoomsFromOcr("Dean’s Office", ROOMS)[0]).toMatchObject({ room: DEAN, isExact: true });
    expect(matchRoomsFromOcr("Deans Office", ROOMS)[0]).toMatchObject({ room: DEAN, isExact: true });
    expect(matchRoomsFromOcr("Office of the Dean", ROOMS).some((m) => m.isExact)).toBe(false);
  });

  it("matches accented names from a plain read", () => {
    expect(matchRoomsFromOcr("CAFE", ROOMS)[0]).toMatchObject({ room: CAFE, isExact: true });
  });

  it("matches an extra term exactly", () => {
    const lab = room("Computer Lab", "Computer Lab", ["cl-1"]);
    expect(matchRoomsFromOcr("CL-1", [...ROOMS, lab])[0]).toMatchObject({ room: lab, isExact: true });
  });

  it("only suggests on a partial read that is close to several rooms", () => {
    const matches = matchRoomsFromOcr("GD1-10", ROOMS);
    expect(matches.some((m) => m.isExact)).toBe(false);
    expect(names(matches).slice(0, 2).sort()).toEqual(["GD1-101", "GD1-102"]);
  });

  it("suggests a room for a misread character, without opening it", () => {
    const matches = matchRoomsFromOcr("GD1-1O1", ROOMS);
    expect(matches[0].room).toBe(GD101);
    expect(matches[0].isExact).toBe(false);
  });

  it("offers every room sharing a term instead of opening one", () => {
    const a = room("Restroom A", "Restroom");
    const b = room("Restroom B", "Restroom");
    const matches = matchRoomsFromOcr("RESTROOM", [a, b, ...ROOMS]);
    expect(matches.slice(0, 2).map((m) => m.matchesTerm)).toEqual([true, true]);
    expect(matches.some((m) => m.isExact)).toBe(false);
  });

  it("prefers a dashed match over a bare one", () => {
    // Both read bare as "gd1101"; the dash says which.
    const other = room("GD11-01");
    const matches = matchRoomsFromOcr("GD1-101", [GD101, other]);
    expect(matches[0]).toMatchObject({ room: GD101, isExact: true });
    expect(matchRoomsFromOcr("GD1101", [GD101, other]).some((m) => m.isExact)).toBe(false);
  });

  it("matches a room whose stored terms predate the current format", () => {
    const old = { roomName: "Dean's Office", node: {}, placard: { ocrEnabled: true, placardName: "", ocrSearchTerms: ["deansoffice"] } };
    expect(matchRoomsFromOcr("Dean's Office", [old])[0].isExact).toBe(true);
  });

  it("returns nothing for an empty read or no rooms", () => {
    expect(matchRoomsFromOcr("  ", ROOMS)).toEqual([]);
    expect(matchRoomsFromOcr("GD1-101", [])).toEqual([]);
  });
});
