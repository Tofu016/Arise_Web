import { describe, it, expect } from "vitest";
import {
  searchNodes,
  searchRooms,
  buildSearchableRooms,
  searchCampus,
  pickSuggestions,
  findRoomForMarker,
  findMarkerForRoom,
  resolveExactNodeMatch,
  rankNodeMatches,
  listAllRooms,
  rankRoomMatches,
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
  it("keeps rooms without a record, with a null placard, when asked", () => {
    const rooms = buildSearchableRooms(nodes, (n) => (n === "203" ? {} : null), { includeWithoutDetails: true });
    expect(rooms.map((r) => r.roomName)).toEqual(["203", "2033", "Registrar"]);
    expect(rooms[1].placard).toBeNull();
    expect(searchRooms("registrar", rooms).map((r) => r.roomName)).toEqual(["Registrar"]);
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

describe("findMarkerForRoom", () => {
  const node = {
    markers: [
      { id: "m1", type: "facility", label: "Registrar" },
      { id: "m2", type: "room", label: "  REG-istrar " },
      { id: "m3", type: "room", label: "203" },
    ],
  };
  it("finds the room marker whose label names the room, ignoring case, spacing and punctuation", () => {
    expect(findMarkerForRoom(node, "Registrar")?.id).toBe("m2");
    expect(findMarkerForRoom(node, "203")?.id).toBe("m3");
  });
  it("finds nothing when the node has no room marker for it", () => {
    expect(findMarkerForRoom(node, "2033")).toBeUndefined();
    expect(findMarkerForRoom(node, "")).toBeUndefined();
    expect(findMarkerForRoom({}, "203")).toBeUndefined();
    expect(findMarkerForRoom(null, "203")).toBeUndefined();
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

describe("rankNodeMatches", () => {
  const list = [
    { id: "COE-1F-002", name: "Lobby West", rooms: [] },
    { id: "COE-1F-001", name: "Library Hallway", rooms: ["Library"] },
    { id: "COE-2F-001", name: "Hallway", rooms: ["203"] },
  ];

  it("returns the list untouched for a blank query", () => {
    expect(rankNodeMatches("  ", list)).toBe(list);
  });

  it("matches IDs, names and rooms, best match first, without truncating", () => {
    expect(rankNodeMatches("library", list).map((n) => n.id)).toEqual(["COE-1F-001"]);
    expect(rankNodeMatches("hallway", list).map((n) => n.id)).toEqual(["COE-2F-001", "COE-1F-001"]);
    expect(rankNodeMatches("coe 1f", list).map((n) => n.id)).toEqual(["COE-1F-002", "COE-1F-001"]);
    expect(rankNodeMatches("203", list).map((n) => n.id)).toEqual(["COE-2F-001"]);
  });

  it("forgives typos in letters-only queries, ranked after real matches", () => {
    expect(rankNodeMatches("libary", list).map((n) => n.id)).toEqual(["COE-1F-001"]);
    expect(rankNodeMatches("lobby", [...list, { id: "x", name: "Loby", rooms: [] }]).map((n) => n.id)).toEqual(["COE-1F-002", "x"]);
  });
});

describe("listAllRooms", () => {
  it("lists every room on every node, details or not, without deduping", () => {
    const dupes = [...nodes, { id: "n4", name: "Annex", rooms: ["203"] }];
    const rooms = listAllRooms(dupes, getForRoom);
    expect(rooms.map((r) => `${r.node.id}/${r.roomName}`)).toEqual(["n1/203", "n1/2033", "n2/Registrar", "n4/203"]);
    expect(rooms[1].placard).toEqual({});
    expect(listAllRooms([{ id: "x", name: "X", rooms: ["Nope"] }], getForRoom)[0].placard).toBeNull();
  });
});

describe("rankRoomMatches", () => {
  const rooms = listAllRooms(nodes, getForRoom);
  const names = (q) => rankRoomMatches(q, rooms).map((r) => r.roomName);

  it("keeps list order for a blank query", () => {
    expect(rankRoomMatches("", rooms)).toBe(rooms);
  });

  it("ranks exact room name, then partial, then text", () => {
    expect(names("203")).toEqual(["203", "2033"]);
    expect(names("math")).toEqual(["203"]);
  });

  it("finds rooms through their node's ID or name", () => {
    expect(names("n1")).toEqual(["203", "2033"]);
    expect(names("hallway 2")).toEqual(["Registrar"]);
  });

  it("forgives typos in the room name", () => {
    expect(names("registar")).toEqual(["Registrar"]);
  });
});
