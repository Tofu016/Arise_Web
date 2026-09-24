import { describe, it, expect } from "vitest";
import { elevatorEdges, elevatorDestinationsFrom, elevatorGroupWarnings, validateElevatorMarker } from "./elevators";

const elevatorMarker = (id, groupId, accessibleFloors) => ({
  id,
  type: "elevator",
  label: `Elevator ${groupId}`,
  yaw: 0,
  pitch: 0,
  elevatorGroupId: groupId,
  accessibleFloors,
});

const node = (id, floor, markers = []) => ({ id, building: "gd1", floor, neighbors: [], markers });

describe("elevatorEdges", () => {
  it("connects two landings of the same elevator that both list each other's floor", () => {
    const nodes = [
      node("f1", 1, [elevatorMarker("m1", "E1", [1, 2])]),
      node("f2", 2, [elevatorMarker("m2", "E1", [1, 2])]),
    ];
    expect(elevatorEdges(nodes)).toEqual([{ a: "f1", b: "f2", groupId: "E1" }]);
  });

  it("does not connect landings that only agree in one direction", () => {
    const nodes = [
      node("f1", 1, [elevatorMarker("m1", "E1", [1, 2])]),
      node("f2", 2, [elevatorMarker("m2", "E1", [2])]), // doesn't list floor 1
    ];
    expect(elevatorEdges(nodes)).toEqual([]);
  });

  it("does not connect markers with different elevatorGroupIds", () => {
    const nodes = [
      node("f1", 1, [elevatorMarker("m1", "E1", [1, 2])]),
      node("f2", 2, [elevatorMarker("m2", "E2", [1, 2])]),
    ];
    expect(elevatorEdges(nodes)).toEqual([]);
  });

  it("connects every pair in a 3-floor elevator", () => {
    const nodes = [
      node("f1", 1, [elevatorMarker("m1", "E1", [1, 2, 3])]),
      node("f2", 2, [elevatorMarker("m2", "E1", [1, 2, 3])]),
      node("f3", 3, [elevatorMarker("m3", "E1", [1, 2, 3])]),
    ];
    expect(elevatorEdges(nodes)).toHaveLength(3);
  });

  it("ignores non-elevator markers and markers with no group id", () => {
    const nodes = [
      node("f1", 1, [{ id: "m1", type: "room", label: "R", yaw: 0, pitch: 0 }]),
      node("f2", 2, [elevatorMarker("m2", "", [1, 2])]),
    ];
    expect(elevatorEdges(nodes)).toEqual([]);
  });
});

describe("elevatorDestinationsFrom", () => {
  it("returns the connected nodes, not the marker's own node", () => {
    const nodes = [
      node("f1", 1, [elevatorMarker("m1", "E1", [1, 3])]),
      node("f2", 2, [elevatorMarker("m2", "E1", [1, 3])]), // floor 2 not in f1's list
      node("f3", 3, [elevatorMarker("m3", "E1", [1, 3])]),
    ];
    const dest = elevatorDestinationsFrom(nodes, "f1").map((n) => n.id);
    expect(dest).toEqual(["f3"]);
  });
});

describe("elevatorGroupWarnings", () => {
  it("flags a group whose landings disagree on accessible floors", () => {
    const nodes = [
      node("f1", 1, [elevatorMarker("m1", "E1", [1, 2])]),
      node("f2", 2, [elevatorMarker("m2", "E1", [1, 2, 3])]),
    ];
    expect(elevatorGroupWarnings(nodes)).toEqual([{ groupId: "E1", nodeIds: ["f1", "f2"] }]);
  });

  it("has nothing to flag when every landing agrees", () => {
    const nodes = [
      node("f1", 1, [elevatorMarker("m1", "E1", [1, 2])]),
      node("f2", 2, [elevatorMarker("m2", "E1", [1, 2])]),
    ];
    expect(elevatorGroupWarnings(nodes)).toEqual([]);
  });
});

describe("validateElevatorMarker", () => {
  const floors = [-1, 1, 2, 3];

  it("requires an elevator group id", () => {
    const errors = validateElevatorMarker({ elevatorGroupId: "", accessibleFloors: [1, 2], floor: 1 }, floors);
    expect(errors.some((e) => e.includes("Elevator ID"))).toBe(true);
  });

  it("requires at least 2 accessible floors", () => {
    const errors = validateElevatorMarker({ elevatorGroupId: "E1", accessibleFloors: [1], floor: 1 }, floors);
    expect(errors.some((e) => e.includes("at least"))).toBe(true);
  });

  it("requires the node's own floor to be included", () => {
    const errors = validateElevatorMarker({ elevatorGroupId: "E1", accessibleFloors: [2, 3], floor: 1 }, floors);
    expect(errors.some((e) => e.includes("own floor"))).toBe(true);
  });

  it("rejects a floor the building doesn't have", () => {
    const errors = validateElevatorMarker({ elevatorGroupId: "E1", accessibleFloors: [1, 9], floor: 1 }, floors);
    expect(errors.some((e) => e.includes("doesn't have floor"))).toBe(true);
  });

  it("passes a valid draft", () => {
    expect(validateElevatorMarker({ elevatorGroupId: "E1", accessibleFloors: [1, 2], floor: 1 }, floors)).toEqual([]);
  });
});
