import { describe, it, expect } from "vitest";
import * as route from "./directionsRoute";

// a - b - c - d in a line, plus e off b
const node = (id, neighbors, extra = {}) => ({ id, name: id.toUpperCase(), neighbors, ...extra });
const nodes = [
  node("a", ["b"]),
  node("b", ["a", "c", "e"]),
  node("c", ["b", "d"]),
  node("d", ["c"], { markers: [{ type: "exit", label: " Assembly Point " }] }),
  node("e", ["b"], { markers: [{ type: "exit", label: "Emergency Fire Stairs" }] }),
  node("z", []), // unreachable
];
const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
const rooms = [{ roomName: "Rm 203", node: byId.c, placard: {} }];

const withPath = (stepIndex = 0, extra = {}) => ({
  ...route.openDirectionsTo(byId.a, byId.d),
  fromId: "a",
  path: ["a", "b", "c", "d"],
  stepIndex,
  ...extra,
});

describe("opening", () => {
  it("openDirectionsTo starts at the current node with the destination set and no path", () => {
    expect(route.openDirectionsTo(byId.a, byId.d)).toMatchObject({
      fromId: "a", fromQuery: "A", toId: "d", toQuery: "D", path: null, kind: "point", autoWalking: false,
    });
  });

  it("nearest exit routes to an Assembly Point marker, ignoring other exit markers", () => {
    const d = route.openNearestExit(byId.a, nodes);
    expect(d).toMatchObject({ kind: "exit", toId: "d", path: ["a", "b", "c", "d"], error: "" });
  });

  it("nearest exit picks the shortest of several assembly points", () => {
    const ns = [
      node("a", ["b", "x"]),
      node("b", ["a", "far"], { markers: [{ type: "exit", label: "assembly point" }] }),
      node("x", ["a", "y"]),
      node("y", ["x"], { markers: [{ type: "exit", label: "Assembly Point" }] }),
      node("far", ["b"]),
    ];
    expect(route.openNearestExit(ns[0], ns).toId).toBe("b");
  });

  it("says so when no assembly point exists", () => {
    const d = route.openNearestExit(byId.a, [node("a", [])]);
    expect(d.error).toMatch(/No assembly point/);
    expect(d.path).toBeNull();
  });

  it("says so when no assembly point is reachable", () => {
    const ns = [node("a", []), node("d", [], { markers: [{ type: "exit", label: "Assembly Point" }] })];
    expect(route.openNearestExit(ns[0], ns).error).toMatch(/No walkable route/);
  });
});

describe("From/To fields", () => {
  it("typing clears the resolved id and any stale path", () => {
    const d = route.editField(withPath(), "to", "Rm");
    expect(d).toMatchObject({ toQuery: "Rm", toId: null, path: null, editingField: "to" });
  });
  it("picking a node or a room fills the field and stops editing", () => {
    const d = route.focusField(route.openDirectionsTo(byId.a, byId.d), "from");
    expect(route.pickNodeField(d, "from", byId.b)).toMatchObject({ fromQuery: "B", fromId: "b", editingField: null });
    expect(route.pickRoomField(d, "to", rooms[0])).toMatchObject({ toQuery: "Rm 203", toId: "c", editingField: null });
  });
  it("activeQuery is the field being edited, else empty", () => {
    expect(route.activeQuery(null)).toBe("");
    expect(route.activeQuery(route.focusField(withPath(), "to"))).toBe("D");
    expect(route.activeQuery(withPath())).toBe("");
  });
});

describe("getDirections", () => {
  it("routes between picked nodes", () => {
    expect(route.getDirections(withPath(2, { path: null, stepIndex: 2 }), nodes, rooms)).toMatchObject({
      path: ["a", "b", "c", "d"], stepIndex: 0, error: "",
    });
  });
  it("resolves typed exact names, node names first then room names, and saves the ids", () => {
    const d = { ...route.openDirectionsTo(byId.a, byId.d), fromId: null, fromQuery: " a ", toId: null, toQuery: "rm 203" };
    expect(route.getDirections(d, nodes, rooms)).toMatchObject({ fromId: "a", toId: "c", path: ["a", "b", "c"] });
  });
  it("does not guess from a partial name", () => {
    const d = { ...route.openDirectionsTo(byId.a, byId.d), toId: null, toQuery: "Rm 2" };
    expect(route.getDirections(d, nodes, rooms).error).toMatch(/Pick both/);
  });
  it("reports an unreachable destination and clears the path", () => {
    const d = { ...route.openDirectionsTo(byId.a, byId.z), path: ["stale"] };
    expect(route.getDirections(d, nodes, rooms)).toMatchObject({ path: null });
    expect(route.getDirections(d, nodes, rooms).error).toMatch(/No walkable route/);
  });
});

describe("following the visitor", () => {
  it("advances the step when they follow the route", () => {
    expect(route.syncToPosition(withPath(0), "c", nodes).stepIndex).toBe(2);
  });
  it("returns the same state when nothing changed", () => {
    const d = withPath(1);
    expect(route.syncToPosition(d, "b", nodes)).toBe(d);
    expect(route.syncToPosition(null, "b", nodes)).toBeNull();
    const noPath = route.openDirectionsTo(byId.a, byId.d);
    expect(route.syncToPosition(noPath, "b", nodes)).toBe(noPath);
  });
  it("re-routes when they wander off", () => {
    expect(route.syncToPosition(withPath(1), "e", nodes)).toMatchObject({
      path: ["e", "b", "c", "d"], stepIndex: 0, error: "",
    });
  });
  it("drops the route with an explanation when it is lost", () => {
    const d = route.syncToPosition(withPath(1), "z", nodes);
    expect(d.path).toBeNull();
    expect(d.error).toMatch(/Lost the route/);
  });
});

describe("stepping and auto-walk", () => {
  const hotspots = [{ id: "b", yaw: 90 }, { id: "e", yaw: 200 }];

  it("nextStep names the next stop and which way to face", () => {
    expect(route.nextStep(withPath(0), hotspots)).toEqual({ id: "b", yaw: 90 });
  });
  it("nextStep has no yaw when the hotspot isn't on this node, and is null at the end", () => {
    expect(route.nextStep(withPath(1), hotspots)).toEqual({ id: "c", yaw: undefined });
    expect(route.nextStep(withPath(3), hotspots)).toBeNull();
    expect(route.nextStep(null, hotspots)).toBeNull();
  });

  it("toggles auto-walk on and off", () => {
    const on = route.toggleAutoWalk(withPath(0));
    expect(on.autoWalking).toBe(true);
    expect(route.toggleAutoWalk(on).autoWalking).toBe(false);
  });
  it("auto-walk keeps going mid-route", () => {
    const d = withPath(1, { autoWalking: true });
    expect(route.settleAutoWalk(d)).toBe(d);
  });
  it("auto-walk stops itself on arrival or when the route is gone", () => {
    expect(route.settleAutoWalk(withPath(3, { autoWalking: true })).autoWalking).toBe(false);
    expect(route.settleAutoWalk(withPath(1, { autoWalking: true, path: null })).autoWalking).toBe(false);
  });
  it("closing directions takes auto-walk with it (there is nothing left to walk)", () => {
    expect(route.settleAutoWalk(null)).toBeNull();
  });
});

describe("routeProgress", () => {
  const hotspots = [{ id: "c", yaw: 100 }];

  it("gives no turn instruction at the first stop", () => {
    const p = route.routeProgress(withPath(0), { byId, hotspots: [{ id: "b", yaw: 0 }], entryYaw: 0 });
    expect(p).toMatchObject({ arrived: false, nextStopId: "b", nextStopName: "B", turnInstruction: null });
  });
  it("gives one once past the first stop", () => {
    const p = route.routeProgress(withPath(1), { byId, hotspots, entryYaw: 0 });
    expect(p.turnInstruction).toBe("Turn right toward");
    expect(p.nextStopHotspot).toEqual({ id: "c", yaw: 100 });
  });
  it("knows when the visitor has arrived", () => {
    expect(route.routeProgress(withPath(3), { byId, hotspots: [], entryYaw: 0 })).toMatchObject({
      arrived: true, nextStopId: null,
    });
  });
  it("copes with no directions open", () => {
    expect(route.routeProgress(null, { byId, hotspots: [], entryYaw: 0 })).toMatchObject({
      arrived: false, nextStopId: null, turnInstruction: null,
    });
  });
});
