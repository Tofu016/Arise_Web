import { describe, it, expect } from "vitest";
import { findPath, getTurnInstruction } from "./pathfinding";

const node = (id, floor, extra = {}) => ({ id, building: "gd1", floor, type: "hallway", neighbors: [], markers: [], ...extra });
const link = (a, b) => {
  a.neighbors.push(b.id);
  b.neighbors.push(a.id);
};
const elevatorMarker = (id, elevatorId, accessibleFloors) => ({
  id,
  type: "elevator",
  label: "E",
  yaw: 0,
  pitch: 0,
  elevatorId,
  accessibleFloors,
});

describe("findPath", () => {
  it("finds the shortest hop path with the default mode, unchanged from before elevators existed", () => {
    const a = node("a", 1);
    const b = node("b", 1);
    const c = node("c", 1);
    link(a, b);
    link(b, c);
    expect(findPath([a, b, c], "a", "c")).toEqual(["a", "b", "c"]);
  });

  it("'stairs' mode walks straight through a manually-linked transition node, same as before", () => {
    const a = node("a", 1);
    const stairs1 = node("s1", 1, { type: "transition" });
    const stairs2 = node("s2", 2, { type: "transition" });
    const b = node("b", 2);
    link(a, stairs1);
    link(stairs1, stairs2);
    link(stairs2, b);
    expect(findPath([a, stairs1, stairs2, b], "a", "b", "stairs")).toEqual(["a", "s1", "s2", "b"]);
  });

  it("'elevator' mode refuses to cross floors through a transition node when no elevator exists", () => {
    const a = node("a", 1);
    const stairs1 = node("s1", 1, { type: "transition" });
    const stairs2 = node("s2", 2, { type: "transition" });
    const b = node("b", 2);
    link(a, stairs1);
    link(stairs1, stairs2);
    link(stairs2, b);
    expect(findPath([a, stairs1, stairs2, b], "a", "b", "elevator")).toBeNull();
  });

  it("'elevator' mode routes through an elevator marker connection instead of stairs", () => {
    const a = node("a", 1, { markers: [elevatorMarker("m1", "E1", [1, 2])] });
    const b = node("b", 2, { markers: [elevatorMarker("m2", "E1", [1, 2])] });
    expect(findPath([a, b], "a", "b", "elevator")).toEqual(["a", "b"]);
  });

  it("'stairs' mode never uses an elevator connection even when one exists", () => {
    const a = node("a", 1, { markers: [elevatorMarker("m1", "E1", [1, 2])] });
    const b = node("b", 2, { markers: [elevatorMarker("m2", "E1", [1, 2])] });
    expect(findPath([a, b], "a", "b", "stairs")).toBeNull();
  });

  it("'any' mode (default) will use either an elevator or a stairs connection", () => {
    const a = node("a", 1, { markers: [elevatorMarker("m1", "E1", [1, 2])] });
    const b = node("b", 2, { markers: [elevatorMarker("m2", "E1", [1, 2])] });
    expect(findPath([a, b], "a", "b")).toEqual(["a", "b"]);
  });

  it("same-floor edges are never excluded by 'elevator' mode", () => {
    const a = node("a", 1);
    const b = node("b", 1);
    link(a, b);
    expect(findPath([a, b], "a", "b", "elevator")).toEqual(["a", "b"]);
  });

  it("never routes THROUGH a fire exit (transitionExit) — emergency-only, not standard stairs", () => {
    const a = node("a", 1);
    const exit1 = node("x1", 1, { type: "transitionExit" });
    const exit2 = node("x2", 2, { type: "transitionExit" });
    const b = node("b", 2);
    link(a, exit1);
    link(exit1, exit2);
    link(exit2, b);
    expect(findPath([a, exit1, exit2, b], "a", "b")).toBeNull();
    expect(findPath([a, exit1, exit2, b], "a", "b", "stairs")).toBeNull();
  });

  it("still allows a fire exit as the route's own start or end point", () => {
    const a = node("a", 1);
    const exit1 = node("x1", 1, { type: "transitionExit" });
    link(a, exit1);
    expect(findPath([a, exit1], "a", "x1")).toEqual(["a", "x1"]);
  });

  it("a Stairs (transition) node is unaffected by the fire-exit exclusion", () => {
    const a = node("a", 1);
    const stairs = node("s1", 1, { type: "transition" });
    const b = node("b", 1);
    link(a, stairs);
    link(stairs, b);
    expect(findPath([a, stairs, b], "a", "b")).toEqual(["a", "s1", "b"]);
  });
});

describe("getTurnInstruction", () => {
  it("reads a small delta as going straight", () => {
    expect(getTurnInstruction(0, 10)).toBe("Go straight through");
  });
  it("reads a large delta as turning around", () => {
    expect(getTurnInstruction(0, 180)).toBe("Turn around toward");
  });
});
