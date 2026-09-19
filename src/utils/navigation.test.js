import { describe, it, expect, beforeEach } from "vitest";
import {
  NAV_DEBOUNCE_MS,
  initialNavigation,
  pickDefaultNode,
  pickDefaultEntranceForBuilding,
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

  it("jump is a fresh start: history cleared, facing forward", () => {
    const start = { ...at("b"), history: ["a"], entryYaw: 45 };
    const { nav } = requestJump(start, world, { id: "a" }, tick());
    expect(nav).toMatchObject({ currentId: "a", history: [], entryYaw: 0 });
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
