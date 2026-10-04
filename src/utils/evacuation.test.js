import { describe, it, expect } from "vitest";
import {
  auditEmergencyCoverage,
  canBeDestinationPoint,
  findEvacuationRoute,
  resolveDestinationPoints,
} from "./evacuation";

const node = (id, floor, extra = {}) => ({
  id, name: id.toUpperCase(), building: "gd1", floor, type: "hallway", neighbors: [], markers: [], ...extra,
});
// A ticked ground-floor node: the common destination in these tests.
const door = (id, floor = 1, extra = {}) =>
  node(id, floor, { type: "fire_exit", isEmergencyDestination: true, ...extra });
const link = (a, b) => {
  a.neighbors.push(b.id);
  b.neighbors.push(a.id);
};
const chain = (...nodes) => nodes.slice(1).forEach((n, i) => link(nodes[i], n));
const elevatorMarker = (id, elevatorId, accessibleFloors) => ({
  id, type: "elevator", label: "E", yaw: 0, pitch: 0, elevatorId, accessibleFloors,
});

describe("which nodes are destination points", () => {
  it("nothing is automatic: unticked Open Area, Parking, Lobby, Entrance and Fire Exit nodes do not count", () => {
    const nodes = ["open_area", "parking", "lobby", "entrance", "fire_exit"].map((type) => node(type, 1, { type }));
    expect([...resolveDestinationPoints(nodes)]).toEqual([]);
  });

  it("a ticked Open Area, Parking, Lobby, Entrance or Fire Exit counts", () => {
    const nodes = ["open_area", "parking", "lobby", "entrance", "fire_exit"].map((type) =>
      node(type, 1, { type, isEmergencyDestination: true })
    );
    expect([...resolveDestinationPoints(nodes)].sort()).toEqual(["entrance", "fire_exit", "lobby", "open_area", "parking"]);
  });

  it("a tick on any other type is ignored", () => {
    for (const type of ["hallway", "stairs", "building_transition"]) {
      expect(canBeDestinationPoint(node("x", 1, { type, isEmergencyDestination: true }))).toBe(false);
    }
  });

  it("a tick above the ground floor is ignored, so a lobby ticked on every floor cannot trap anyone", () => {
    expect(canBeDestinationPoint(node("l1", 1, { type: "lobby" }))).toBe(true);
    expect(canBeDestinationPoint(node("l2", 2, { type: "lobby" }))).toBe(false);
    const a = node("a", 2);
    const upperLobby = node("l2", 2, { type: "lobby", isEmergencyDestination: true });
    link(a, upperLobby);
    expect(findEvacuationRoute([a, upperLobby], "a")).toBeNull();
  });

  it("an underground node can be ticked, and nothing is automatic for a building with none ticked", () => {
    expect(canBeDestinationPoint(node("p", -1, { type: "parking" }))).toBe(true);
    const a = node("a", 1);
    const plainDoor = node("door", 1, { type: "entrance" });
    link(a, plainDoor);
    expect(findEvacuationRoute([a, plainDoor], "a")).toBeNull();
  });
});

describe("the upper-floor mishap", () => {
  // A person on floor 1; the only ticked node near them is an upper-floor
  // fire stairwell, and the real ground exit is further along the same floor.
  const build = (tickUpper) => {
    const start = node("start", 1);
    const s1 = node("s1", 1, { type: "stairs" });
    const s2 = node("s2", 2, { type: "stairs" });
    const s3 = node("s3", 3, { type: "stairs" });
    const upper = node("upper", 3, { type: "fire_exit", isEmergencyDestination: tickUpper });
    const h1 = node("h1", 1);
    const h2 = node("h2", 1);
    const h3 = node("h3", 1);
    const ground = door("ground");
    chain(start, s1, s2, s3, upper);
    chain(start, h1, h2, h3, ground);
    return [start, s1, s2, s3, upper, h1, h2, h3, ground];
  };

  it("leads to the ground exit even though an upper-floor fire exit is fewer hops away", () => {
    for (const tickUpper of [false, true]) {
      const result = findEvacuationRoute(build(tickUpper), "start");
      expect(result.destinationId).toBe("ground");
      expect(result.ascends).toBe(false);
    }
  });

  it("when the ground exit is cut off, there is no route rather than one that climbs to an upper floor", () => {
    expect(findEvacuationRoute(build(true), "start", { blocked: ["h2"] })).toBeNull();
  });
});

describe("climbing", () => {
  it("goes above the ground floor only when no route within it exists, and says so", () => {
    const start = node("start", 1);
    const up = node("up", 2);
    const exit = door("exit");
    chain(start, up, exit); // the only way to the exit goes over floor 2
    expect(findEvacuationRoute([start, up, exit], "start")).toMatchObject({
      path: ["start", "up", "exit"], ascends: true,
    });
  });

  it("climbing to the ground floor from an underground level is the way out, not ascending", () => {
    const basement = node("b1", -1);
    const stairsB = node("sb", -1, { type: "stairs" });
    const stairsG = node("sg", 1, { type: "stairs" });
    const exit = door("exit");
    chain(basement, stairsB, stairsG, exit);
    expect(findEvacuationRoute([basement, stairsB, stairsG, exit], "b1")).toMatchObject({
      path: ["b1", "sb", "sg", "exit"], ascends: false,
    });
  });

  it("an underground exit of its own is preferred to climbing", () => {
    const basement = node("b1", -1);
    const bExit = node("bx", -1, { type: "parking", isEmergencyDestination: true });
    const up = node("up", 1, { type: "stairs" });
    const exit = door("exit");
    link(basement, bExit);
    chain(basement, up, exit);
    expect(findEvacuationRoute([basement, bExit, up, exit], "b1").destinationId).toBe("bx");
  });

  it("from an upper floor it goes down to the ground exit, never up", () => {
    const top = node("top", 4);
    const mid = node("mid", 3, { type: "stairs" });
    const low = node("low", 2, { type: "stairs" });
    const exit = door("exit");
    chain(top, mid, low, exit);
    expect(findEvacuationRoute([top, mid, low, exit], "top")).toMatchObject({ ascends: false, destinationId: "exit" });
  });

  it("when it must climb, it still picks the route with the least climbing", () => {
    const start = node("start", 1);
    const lowUp = node("lowUp", 2);
    const highUp = node("highUp", 4);
    const nearExit = door("near");
    const farExit = door("far");
    chain(start, lowUp, nearExit);
    chain(start, highUp, farExit);
    expect(findEvacuationRoute([start, lowUp, highUp, nearExit, farExit], "start").destinationId).toBe("near");
  });
});

describe("what a route may pass through", () => {
  it("never rides an elevator, even when that is the only way", () => {
    const a = node("a", 2, { markers: [elevatorMarker("m1", "E1", [1, 2])] });
    const exit = door("exit", 1, { markers: [elevatorMarker("m2", "E1", [1, 2])] });
    expect(findEvacuationRoute([a, exit], "a")).toBeNull();
  });

  it("takes the stairs even when an elevator would be shorter", () => {
    const a = node("a", 2, { markers: [elevatorMarker("m1", "E1", [1, 2])] });
    const s2 = node("s2", 2, { type: "stairs" });
    const s1 = node("s1", 1, { type: "stairs" });
    const exit = door("exit", 1, { markers: [elevatorMarker("m2", "E1", [1, 2])] });
    chain(a, s2, s1, exit);
    expect(findEvacuationRoute([a, s2, s1, exit], "a").path).toEqual(["a", "s2", "s1", "exit"]);
  });

  it("passes through a fire stairwell, which ordinary routing refuses to do", () => {
    const a = node("a", 2);
    const fx2 = node("fx2", 2, { type: "fire_exit" });
    const fx1 = node("fx1", 1, { type: "fire_exit" });
    const exit = door("exit");
    chain(a, fx2, fx1, exit);
    expect(findEvacuationRoute([a, fx2, fx1, exit], "a").path).toEqual(["a", "fx2", "fx1", "exit"]);
  });

  it("returns the start itself when it is already a destination point", () => {
    expect(findEvacuationRoute([door("exit")], "exit")).toMatchObject({ path: ["exit"], destinationId: "exit" });
  });

  it("returns null for an unknown start", () => {
    expect(findEvacuationRoute([node("a", 1)], "nope")).toBeNull();
    expect(findEvacuationRoute([node("a", 1)], null)).toBeNull();
  });
});

describe("choosing between destinations", () => {
  it("takes the closer of two same-floor destinations", () => {
    const a = node("a", 1);
    const mid = node("mid", 1);
    const near = door("near");
    const far = door("far");
    link(a, near);
    chain(a, mid, far);
    expect(findEvacuationRoute([a, mid, near, far], "a").destinationId).toBe("near");
  });

  it("breaks an exact tie the same way every time (lowest id)", () => {
    const a = node("a", 1);
    const left = door("left");
    const right = door("right");
    link(a, right);
    link(a, left);
    expect(findEvacuationRoute([a, right, left], "a").destinationId).toBe("left");
    expect(findEvacuationRoute([left, right, a], "a").destinationId).toBe("left");
  });
});

describe("blocked nodes", () => {
  const build = () => {
    const a = node("a", 1);
    const x = node("x", 1);
    const y = node("y", 1);
    const near = door("near");
    const far = door("far");
    const f1 = node("f1", 1);
    chain(a, x, near);
    chain(a, y, f1, far);
    return [a, x, y, near, far, f1];
  };

  it("routes around a node the visitor reported blocked", () => {
    expect(findEvacuationRoute(build(), "a").destinationId).toBe("near");
    expect(findEvacuationRoute(build(), "a", { blocked: ["x"] })).toMatchObject({
      destinationId: "far", path: ["a", "y", "f1", "far"],
    });
  });

  it("returns null once every way out is blocked", () => {
    expect(findEvacuationRoute(build(), "a", { blocked: ["x", "y"] })).toBeNull();
  });

  it("blocking the destination point itself rules it out", () => {
    expect(findEvacuationRoute(build(), "a", { blocked: ["near"] }).destinationId).toBe("far");
  });
});

describe("auditEmergencyCoverage", () => {
  it("classifies every node and reports gaps in the data", () => {
    const exit = door("exit");
    const ok = node("ok", 1);
    const high = node("high", 2);
    const island = node("island", 1);
    const detour = node("detour", 1);
    const over = node("over", 2);
    const overExit = door("overExit");
    const bad = node("bad", 1, { isEmergencyDestination: true });
    const upperTick = node("upperTick", 3, { type: "lobby", isEmergencyDestination: true });
    chain(exit, ok);
    link(high, exit);
    chain(detour, over, overExit); // reachable only by climbing over floor 2
    const gd2 = node("gd2a", 1, { building: "gd2" });

    const audit = auditEmergencyCoverage([exit, ok, high, island, detour, over, overExit, bad, upperTick, gd2]);
    const status = Object.fromEntries(audit.entries.map((e) => [e.id, e.status]));
    expect(status).toMatchObject({
      exit: "destination", ok: "ok", high: "ok", island: "none", detour: "ascends", gd2a: "none", upperTick: "none",
    });
    expect(audit.misflagged.map((n) => n.id).sort()).toEqual(["bad", "upperTick"]);
    expect(audit.buildingsWithoutDestination).toEqual(["gd2"]);
    expect(audit.counts).toMatchObject({ total: 10, destination: 2, ascends: 1 });
  });

  it("lists the destination points", () => {
    const a = node("a", 1);
    const lot = node("lot", 1, { type: "parking", isEmergencyDestination: true });
    link(a, lot);
    expect(auditEmergencyCoverage([a, lot]).destinationPoints).toEqual([
      { id: "lot", name: "LOT", building: "gd1", floor: 1, type: "parking" },
    ]);
  });
});
