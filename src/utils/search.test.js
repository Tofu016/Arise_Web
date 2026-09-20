import { describe, it, expect } from "vitest";
import {
  searchNodes,
  searchRooms,
  buildSearchableRooms,
  searchCampus,
  pickSuggestions,
  findRoomForMarker,
  resolveExactNodeMatch,
} from "./search";

const nodes = [
  { id: "n1", name: "Main Entrance", rooms: ["203", "2033"] },
  { id: "n2", name: "Hallway 2", rooms: ["Registrar"] },
  { id: "n3", name: "Room 203 Annex", rooms: [] },
];
const placards = { "203": { department: "Math" }, "2033": {}, registrar: { department: "Registrar's Office" } };
const getForRoom = (name) => placards[name.toLowerCase()];

describe("buildSearchableRooms", () => {
  it("keeps only rooms that have a detail record", () => {
    const rooms = buildSearchableRooms(nodes, (n) => (n === "203" ? {} : null));
    expect(rooms.map((r) => r.roomName)).toEqual(["203"]);
  });
  it("dedupes case-insensitively, first node wins", () => {
    const ns = [
      { id: "a", name: "A", rooms: ["rm 1"] },
      { id: "b", name: "B", rooms: ["RM 1 "] },
    ];
    const rooms = buildSearchableRooms(ns, () => ({}));
    expect(rooms).toHaveLength(1);
    expect(rooms[0].node.id).toBe("a");
  });
  it("handles no nodes", () => {
    expect(buildSearchableRooms(null, getForRoom)).toEqual([]);
  });
});

describe("ranking", () => {
  it("an exact room match beats a partial one, which beats a name match", () => {
    expect(searchNodes("203", nodes).map((n) => n.id)).toEqual(["n1", "n3"]);
  });
  it("rooms rank exact, partial, then description text", () => {
    const rooms = buildSearchableRooms(nodes, getForRoom);
    expect(searchRooms("203", rooms).map((r) => r.roomName)).toEqual(["203", "2033"]);
    expect(searchRooms("registrar", rooms).map((r) => r.roomName)).toEqual(["Registrar"]);
    expect(searchRooms("math", rooms).map((r) => r.roomName)).toEqual(["203"]);
  });
});

describe("searchCampus", () => {
  const rooms = buildSearchableRooms(nodes, getForRoom);

  it("returns rooms, and places that room results haven't already covered", () => {
    const { roomResults, placeResults } = searchCampus("203", nodes, rooms);
    expect(roomResults.map((r) => r.roomName)).toEqual(["203", "2033"]);
    expect(placeResults.map((n) => n.id)).toEqual(["n3"]); // n1 is already shown via its room
  });
  it("returns nothing for a blank query", () => {
    expect(searchCampus("  ", nodes, rooms)).toEqual({ roomResults: [], placeResults: [] });
  });
  it("tolerates nodes not having loaded", () => {
    expect(searchCampus("203", null, rooms).placeResults).toEqual([]);
  });
});

describe("pickSuggestions", () => {
  const rooms = Array.from({ length: 10 }, (_, i) => ({ roomName: `R${i}` }));

  it("returns at most `count` rooms, without mutating its input", () => {
    const copy = [...rooms];
    expect(pickSuggestions(rooms, 6)).toHaveLength(6);
    expect(rooms).toEqual(copy);
  });
  it("returns every room when there are fewer than asked for", () => {
    expect(pickSuggestions(rooms.slice(0, 3), 6)).toHaveLength(3);
    expect(pickSuggestions([], 6)).toEqual([]);
  });
  it("is deterministic given a fixed source of randomness", () => {
    expect(pickSuggestions(rooms, 6, () => 0)).toEqual(pickSuggestions(rooms, 6, () => 0));
  });
});

describe("findRoomForMarker", () => {
  const rooms = buildSearchableRooms(nodes, getForRoom);
  it("matches the marker label ignoring case and whitespace", () => {
    expect(findRoomForMarker({ label: "  registrar " }, rooms).roomName).toBe("Registrar");
  });
  it("finds nothing for a label with no saved room details", () => {
    expect(findRoomForMarker({ label: "Nope" }, rooms)).toBeUndefined();
    expect(findRoomForMarker({}, rooms)).toBeUndefined();
  });
});

describe("resolveExactNodeMatch", () => {
  const rooms = buildSearchableRooms(nodes, getForRoom);
  it("matches a node name exactly, ignoring case and whitespace", () => {
    expect(resolveExactNodeMatch(" main entrance ", nodes, rooms).id).toBe("n1");
  });
  it("falls back to a room's node", () => {
    expect(resolveExactNodeMatch("registrar", nodes, rooms).id).toBe("n2");
  });
  it("does not guess from partial text", () => {
    expect(resolveExactNodeMatch("main", nodes, rooms)).toBeNull();
    expect(resolveExactNodeMatch("", nodes, rooms)).toBeNull();
    expect(resolveExactNodeMatch("x", null, rooms)).toBeNull();
  });
});

describe("forgiving matching", () => {
  const rooms = buildSearchableRooms(nodes, getForRoom);

  it("ignores case and spaces in what's typed and in what's stored", () => {
    expect(searchNodes("MAINENTRANCE", nodes).map((n) => n.id)).toEqual(["n1"]);
    expect(searchNodes("  main   entrance ", nodes).map((n) => n.id)).toEqual(["n1"]);
    expect(searchNodes("room203annex", nodes).map((n) => n.id)).toEqual(["n3"]);
    expect(searchRooms("REGISTRARS office", rooms).map((r) => r.roomName)).toEqual(["Registrar"]);
  });
  it("tolerates a typo in a word, and ranks those after real matches", () => {
    expect(searchNodes("entrnace", nodes).map((n) => n.id)).toEqual(["n1"]);
    expect(searchRooms("registar", rooms).map((r) => r.roomName)).toEqual(["Registrar"]);
    const ns = [{ id: "a", name: "Hallway", rooms: [] }, { id: "b", name: "Hello Hall", rooms: [] }];
    expect(searchNodes("hall", ns).map((n) => n.id)).toEqual(["a", "b"]); // prefix, then contains
    expect(searchNodes("hell", ns).map((n) => n.id)).toEqual(["b", "a"]); // contains beats typo
  });
  it("never blurs one room number into another", () => {
    expect(searchNodes("204", nodes)).toEqual([]);
    expect(searchRooms("208", rooms)).toEqual([]);
  });
  it("does not fuzz very short queries", () => {
    expect(searchNodes("mun", nodes)).toEqual([]);
  });
  it("matches markers and typed directions endpoints without regard to case or spacing", () => {
    expect(findRoomForMarker({ label: "  reg istrar" }, rooms)?.roomName).toBe("Registrar");
    expect(resolveExactNodeMatch("MAIN entrance", nodes, rooms)?.id).toBe("n1");
    expect(resolveExactNodeMatch("main entrnace", nodes, rooms)).toBeNull(); // exact only
  });
});
