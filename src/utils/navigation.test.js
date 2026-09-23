import { describe, it, expect, beforeEach } from "vitest";
import {
  NAV_DEBOUNCE_MS,
  initialNavigation,
  pickDefaultNode,
  pickDefaultEntranceForBuilding,
  pickFloorStart,
  pickBuildingStart,
  floorsForBuilding,
  findKioskEntranceShortcuts,
  findMainCampusEntrance,
  kioskBuildingHasChoice,
  landOnDefault,
  findFlyover,
  requestWalk,
  requestJump,
  requestBack,
  completeFlyover,
  cancelFlyover,
} from "./navigation";

const buildings = [
  { id: "gd1", label: "GD1", lat: 1, lng: 1 },
  { id: "gd2", label: "GD2", lat: 1, lng: 1 }, // same cluster as GD1
  { id: "far", label: "Far", lat: 5, lng: 5 },
  { id: "nocoords", label: "No coords" },
];
const node = (id, building, extra = {}) => ({ id, building, name: id, floor: 1, ...extra });
const nodes = [node("a", "gd1"), node("b", "gd1"), node("c", "gd2"), node("f", "far"), node("n", "nocoords")];
const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
const world = { byId, buildings };

// Each move happens well past the previous one's debounce window.
let clock;
const tick = () => (clock += NAV_DEBOUNCE_MS + 1);
const at = (id) => ({ ...initialNavigation(), currentId: id });

describe("default landing", () => {
  it("prefers entrances in building order, lowest floor first", () => {
    const ns = [
      node("h", "gd1", { type: "hallway" }),
      node("e2", "gd2", { type: "entrance", floor: 1 }),
      node("e1b", "gd1", { type: "entrance", floor: 3 }),
      node("e1a", "gd1", { type: "entrance", floor: 1 }),
    ];
    expect(pickDefaultNode(ns, buildings).id).toBe("e1a");
  });
  it("falls back to the first node without entrances, and to null without nodes", () => {
    expect(pickDefaultNode(nodes, buildings).id).toBe("a");
    expect(pickDefaultNode([], buildings)).toBeNull();
  });
  it("picks a building's lowest-floor entrance", () => {
    const ns = [node("x", "gd1", { type: "entrance", floor: 2 }), node("y", "gd1", { type: "entrance", floor: 1 })];
    expect(pickDefaultEntranceForBuilding(ns, "gd1").id).toBe("y");
    expect(pickDefaultEntranceForBuilding(ns, "gd2")).toBeNull();
  });
  it("lands once, and never moves a visitor who is already somewhere", () => {
    const landed = landOnDefault(initialNavigation(), nodes, buildings);
    expect(landed.currentId).toBe("a");
    expect(landOnDefault(at("b"), nodes, buildings).currentId).toBe("b");
    expect(landOnDefault(initialNavigation(), null, buildings).currentId).toBeNull();
  });

  it("faces the default node's own starting view when it has one", () => {
    const ns = [node("a", "gd1", { startingViewYaw: 45, startingViewPitch: -8 })];
    expect(landOnDefault(initialNavigation(), ns, buildings)).toMatchObject({ entryYaw: 45, entryPitch: -8 });
  });

  it("faces forward when the default node has no starting view", () => {
    expect(landOnDefault(initialNavigation(), nodes, buildings)).toMatchObject({ entryYaw: 0, entryPitch: 0 });
  });
});

describe("walk, jump and back", () => {
  beforeEach(() => (clock = 10_000));

  it("walk pushes history and records the way the visitor faced", () => {
    const { nav, outcome, action } = requestWalk(at("a"), world, { id: "b", yaw: 90 }, tick());
    expect(outcome).toBe("moved");
    expect(action.type).toBe("walk");
    expect(nav).toMatchObject({ currentId: "b", history: ["a"], entryYaw: 90 });
  });

  it("walk without a yaw faces forward", () => {
    expect(requestWalk(at("a"), world, { id: "b" }, tick()).nav.entryYaw).toBe(0);
  });

  it("walk also records the pitch the visitor faced", () => {
    const { nav } = requestWalk(at("a"), world, { id: "b", yaw: 90, pitch: -12 }, tick());
    expect(nav).toMatchObject({ entryYaw: 90, entryPitch: -12 });
  });

  it("jump is a fresh start: history cleared, facing forward", () => {
    const start = { ...at("b"), history: ["a"], entryYaw: 45 };
    const { nav } = requestJump(start, world, { id: "a" }, tick());
    expect(nav).toMatchObject({ currentId: "a", history: [], entryYaw: 0, entryPitch: 0 });
  });

  it("jump can face a given view (e.g. a node's own starting view)", () => {
    const { nav } = requestJump(at("b"), world, { id: "a", yaw: 45, pitch: -8 }, tick());
    expect(nav).toMatchObject({ entryYaw: 45, entryPitch: -8 });
  });

  it("back pops history", () => {
    const start = { ...at("b"), history: ["x", "a"], entryYaw: 45 };
    const { nav, outcome } = requestBack(start, world, tick());
    expect(outcome).toBe("moved");
    expect(nav).toMatchObject({ currentId: "a", history: ["x"], entryYaw: 0 });
  });

  it("back with no history is accepted but changes nothing", () => {
    const { nav, outcome } = requestBack(at("a"), world, tick());
    expect(outcome).toBe("moved");
    expect(nav.currentId).toBe("a");
  });

  it("back faces the hotspot in the returning-to node that leads to where you came from", () => {
    const withHotspot = {
      ...world,
      byId: {
        ...byId,
        a: { ...byId.a, neighbors: ["b"], hotspots: { b: { yaw: 200, pitch: -15 } } },
      },
    };
    const start = { ...at("b"), history: ["a"], entryYaw: 45 };
    const { nav } = requestBack(start, withHotspot, tick());
    expect(nav).toMatchObject({ currentId: "a", entryYaw: 200, entryPitch: -15 });
  });

  it("back faces forward when the returning-to node has no hotspot for where you came from", () => {
    const start = { ...at("b"), history: ["a"], entryYaw: 45 };
    const { nav } = requestBack(start, world, tick());
    expect(nav).toMatchObject({ currentId: "a", entryYaw: 0, entryPitch: 0 });
  });

  it("carries the move's meta through untouched", () => {
    const { action } = requestJump(at("a"), world, { id: "b", meta: { room: "203" } }, tick());
    expect(action.meta).toEqual({ room: "203" });
  });
});

describe("debounce", () => {
  it("ignores any second move inside the window, whatever its kind", () => {
    const first = requestWalk(at("a"), world, { id: "b" }, 10_000);
    const second = requestJump(first.nav, world, { id: "a" }, 10_000 + NAV_DEBOUNCE_MS - 1);
    expect(second.outcome).toBe("ignored");
    expect(second.nav).toBe(first.nav);
    expect(requestBack(first.nav, world, 10_000 + NAV_DEBOUNCE_MS - 1).outcome).toBe("ignored");
  });
  it("accepts a move once the window has passed", () => {
    const first = requestWalk(at("a"), world, { id: "b" }, 10_000);
    expect(requestJump(first.nav, world, { id: "a" }, 10_000 + NAV_DEBOUNCE_MS).outcome).toBe("moved");
  });
});

describe("cross-campus flyover", () => {
  beforeEach(() => (clock = 10_000));

  it("is not needed within one cluster (shared coordinates)", () => {
    expect(findFlyover(byId.a, byId.c, buildings)).toBeNull();
  });
  it("is not needed when either end has no coordinates", () => {
    expect(findFlyover(byId.a, byId.n, buildings)).toBeNull();
    expect(findFlyover(byId.n, byId.a, buildings)).toBeNull();
  });
  it("describes the trip between two real, different places", () => {
    expect(findFlyover(byId.a, byId.f, buildings)).toEqual({
      fromLat: 1, fromLng: 1, fromLabel: "GD1", toLat: 5, toLng: 5, toLabel: "Far",
    });
  });

  it.each([
    ["walk", (n) => requestWalk(n, world, { id: "f", yaw: 10 }, tick())],
    ["jump", (n) => requestJump(n, world, { id: "f" }, tick())],
  ])("a %s across campus is held back, not performed", (_, move) => {
    const start = at("a");
    const { nav, outcome } = move(start);
    expect(outcome).toBe("flyover");
    expect(nav.currentId).toBe("a"); // hasn't moved yet
    expect(nav.flyover.toLabel).toBe("Far");
  });

  it("completing the flyover performs the held move", () => {
    const held = requestWalk(at("a"), world, { id: "f", yaw: 10 }, tick()).nav;
    const { nav, outcome, action } = completeFlyover(held);
    expect(outcome).toBe("moved");
    expect(action.type).toBe("walk");
    expect(nav).toMatchObject({ currentId: "f", history: ["a"], entryYaw: 10, flyover: null });
  });

  it("a room-card jump across campus flies over too, and keeps its meta", () => {
    const held = requestJump(at("a"), world, { id: "f", meta: { room: "R" } }, tick()).nav;
    expect(completeFlyover(held).action.meta).toEqual({ room: "R" });
  });

  it("going back across campus flies over too", () => {
    const start = { ...at("f"), history: ["a"] };
    const held = requestBack(start, world, tick());
    expect(held.outcome).toBe("flyover");
    expect(held.nav.currentId).toBe("f");
    expect(completeFlyover(held.nav).nav).toMatchObject({ currentId: "a", history: [] });
  });

  it("cancelling leaves the visitor where they were", () => {
    const held = requestJump(at("a"), world, { id: "f" }, tick()).nav;
    expect(cancelFlyover(held)).toMatchObject({ currentId: "a", flyover: null });
  });

  it("completing with no flyover open does nothing", () => {
    expect(completeFlyover(at("a")).outcome).toBe("ignored");
  });

  it("never flies over from nowhere (before the tour has landed)", () => {
    expect(requestJump(initialNavigation(), world, { id: "f" }, tick()).outcome).toBe("moved");
  });
});

describe("floor and building starts", () => {
  const n = (id, floor, extra = {}) => ({ id, building: "gd1", floor, type: "hallway", ...extra });

  it("prefers the flagged node, then an entrance, then any node on that floor", () => {
    expect(pickFloorStart([n("a", 1), n("b", 1, { startingNode: true })], "gd1", 1).id).toBe("b");
    expect(pickFloorStart([n("a", 1), n("e", 1, { type: "entrance" })], "gd1", 1).id).toBe("e");
    expect(pickFloorStart([n("a", 1)], "gd1", 1).id).toBe("a");
    expect(pickFloorStart([n("a", 1)], "gd1", 2)).toBeNull();
  });

  it("starts a building on its lowest above-ground floor, skipping underground", () => {
    const ns = [n("ug", -1, { startingNode: true }), n("f2", 2, { startingNode: true }), n("f1", 1, { startingNode: true })];
    expect(pickBuildingStart(ns, "gd1").id).toBe("f1");
  });

  it("falls back when a building only has underground nodes", () => {
    expect(pickBuildingStart([n("ug", -1)], "gd1").id).toBe("ug");
    expect(pickBuildingStart([n("ug", -1)], "gd2")).toBeNull();
  });
});

describe("floorsForBuilding", () => {
  const n = (id, building, floor) => ({ id, building, floor, type: "hallway" });

  it("lists every distinct floor, low to high, for that building only", () => {
    const ns = [n("a", "gd1", 2), n("b", "gd1", 1), n("c", "gd1", 1), n("d", "gd2", 3)];
    expect(floorsForBuilding(ns, "gd1")).toEqual([1, 2]);
  });

  it("includes underground floors", () => {
    expect(floorsForBuilding([n("ug", "gd1", -1), n("f1", "gd1", 1)], "gd1")).toEqual([-1, 1]);
  });

  it("is empty for a building with no nodes, or with no nodes at all", () => {
    expect(floorsForBuilding([n("a", "gd1", 1)], "gd2")).toEqual([]);
    expect(floorsForBuilding(null, "gd1")).toEqual([]);
  });
});

describe("findKioskEntranceShortcuts", () => {
  const n = (id, building, extra = {}) => ({ id, building, floor: 1, type: "entrance", ...extra });
  const campus = (id) => (id === "gd2" ? "main" : id === "gd1" ? "main" : id); // gd1/gd2 = one campus

  it("returns both, separately, when the building and campus entrances differ", () => {
    const ns = [n("be", "gd1", { buildingEntrance: true }), n("ce", "gd2", { campusEntrance: true })];
    expect(findKioskEntranceShortcuts(ns, "gd1", campus)).toEqual([
      { key: "building", label: "Building Entrance", nodeId: "be" },
      { key: "campus", label: "Campus Entrance", nodeId: "ce" },
    ]);
  });

  it("collapses to one Campus Entrance button when they're the same node", () => {
    const ns = [n("both", "gd1", { buildingEntrance: true, campusEntrance: true })];
    expect(findKioskEntranceShortcuts(ns, "gd1", campus)).toEqual([
      { key: "campus", label: "Campus Entrance", nodeId: "both" },
    ]);
  });

  it("finds the campus entrance across buildings in the same campus", () => {
    const ns = [n("ce", "gd1", { campusEntrance: true })];
    expect(findKioskEntranceShortcuts(ns, "gd2", campus)).toEqual([
      { key: "campus", label: "Campus Entrance", nodeId: "ce" },
    ]);
  });

  it("omits whichever shortcut has no flagged node", () => {
    expect(findKioskEntranceShortcuts([n("be", "gd1", { buildingEntrance: true })], "gd1", campus)).toEqual([
      { key: "building", label: "Building Entrance", nodeId: "be" },
    ]);
    expect(findKioskEntranceShortcuts([], "gd1", campus)).toEqual([]);
  });

  it("is empty with no nodes or no building", () => {
    expect(findKioskEntranceShortcuts(null, "gd1", campus)).toEqual([]);
    expect(findKioskEntranceShortcuts([n("be", "gd1", { buildingEntrance: true })], null, campus)).toEqual([]);
  });
});

describe("findMainCampusEntrance", () => {
  const n = (id, building, extra = {}) => ({ id, building, floor: 1, type: "entrance", ...extra });
  const campus = (id) => (id === "gd1" || id === "gd2" ? "main" : id);

  it("finds the node flagged as the Main Campus entrance", () => {
    const ns = [n("ce", "gd2", { campusEntrance: true })];
    expect(findMainCampusEntrance(ns, campus)).toBe(ns[0]);
  });

  it("ignores a campus entrance flagged on a different campus", () => {
    const ns = [n("ce", "digital", { campusEntrance: true })];
    expect(findMainCampusEntrance(ns, campus)).toBe(null);
  });

  it("is null with nothing flagged", () => {
    expect(findMainCampusEntrance([n("a", "gd1")], campus)).toBe(null);
    expect(findMainCampusEntrance(null, campus)).toBe(null);
  });
});

describe("kioskBuildingHasChoice", () => {
  const n = (id, building, extra = {}) => ({ id, building, floor: 1, ...extra });
  const campus = (id) => id; // each building its own campus here

  it("is true with more than one floor", () => {
    const ns = [n("a", "gd3", { floor: 1 }), n("b", "gd3", { floor: 2 })];
    expect(kioskBuildingHasChoice(ns, "gd3", campus)).toBe(true);
  });

  it("is true with an entrance shortcut even on a single floor", () => {
    const ns = [n("a", "gd3", { type: "entrance", buildingEntrance: true })];
    expect(kioskBuildingHasChoice(ns, "gd3", campus)).toBe(true);
  });

  it("is false with one floor and no entrance shortcut", () => {
    const ns = [n("a", "gd3"), n("b", "gd3")];
    expect(kioskBuildingHasChoice(ns, "gd3", campus)).toBe(false);
  });
});
