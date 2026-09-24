import { describe, it, expect } from "vitest";
import { findNearbyRooms } from "./nearbyRooms";

// Two floors of the same building (b1) plus one node on an unrelated
// building (b2), which campusForBuilding treats as its own solo campus
// since it isn't grouped in BUILDINGS/buildingStore.
const nodes = [
  { id: "n1", building: "b1", floor: 1, rooms: ["101"], neighbors: ["n2", "n3"] },
  { id: "n2", building: "b1", floor: 1, rooms: ["102"], neighbors: ["n1", "n4"] },
  { id: "n3", building: "b1", floor: 2, rooms: ["201"], neighbors: ["n1", "n5"] },
  { id: "n4", building: "b1", floor: 1, rooms: ["103"], neighbors: ["n2"] },
  { id: "n5", building: "b1", floor: 2, rooms: ["202"], neighbors: ["n3"] },
  { id: "n6", building: "b2", floor: 1, rooms: ["999"], neighbors: ["n1"] },
];

describe("findNearbyRooms", () => {
  it("returns rooms in hop order, nearest first", () => {
    const result = findNearbyRooms(nodes, "n1");
    expect(result.map((r) => r.room)).toEqual(["101", "102", "201", "103", "202"]);
    expect(result.map((r) => r.hops)).toEqual([0, 1, 1, 2, 2]);
  });

  it("keeps a room's nearest occurrence when it's hosted by multiple nodes", () => {
    const dupeNodes = [
      ...nodes,
      { id: "n7", building: "b1", floor: 1, rooms: ["202"], neighbors: ["n2"] }, // 2 hops to "202"
    ];
    const result = findNearbyRooms(dupeNodes, "n1");
    const room202 = result.find((r) => r.room === "202");
    expect(room202.hops).toBe(2);
    expect(room202.nodeId).toBe("n5"); // the original, also 2 hops, wins as first-seen
  });

  it("does not cross a campus boundary", () => {
    const result = findNearbyRooms(nodes, "n1");
    expect(result.some((r) => r.room === "999")).toBe(false);
  });

  it("bounds cross-floor rooms by maxCrossFloorHops but leaves same-floor unbounded by default", () => {
    const result = findNearbyRooms(nodes, "n1", { maxCrossFloorHops: 0 });
    expect(result.map((r) => r.room)).toEqual(["101", "102", "103"]);
  });

  it("bounds every result by maxHops regardless of floor", () => {
    const result = findNearbyRooms(nodes, "n1", { maxHops: 1 });
    expect(result.map((r) => r.room).sort()).toEqual(["101", "102", "201"]);
  });

  it("respects limit", () => {
    const result = findNearbyRooms(nodes, "n1", { limit: 2 });
    expect(result).toHaveLength(2);
  });

  it("returns an empty list for an unknown starting node", () => {
    expect(findNearbyRooms(nodes, "missing")).toEqual([]);
  });
});
