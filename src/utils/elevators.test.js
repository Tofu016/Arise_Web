import { describe, it, expect } from "vitest";
import {
  elevatorEdges,
  elevatorDestinationsFrom,
  elevatorRideBetween,
  arrivalYawFromLanding,
  validateElevator,
  validateElevatorLanding,
  floorsWithLandingsDropped,
} from "./elevators";

const elevatorMarker = (id, elevatorId, accessibleFloors, yaw = 0) => ({
  id,
  type: "elevator",
  label: `Elevator ${elevatorId}`,
  yaw,
  pitch: 0,
  elevatorId,
  accessibleFloors,
});

const node = (id, floor, markers = [], building = "gd1") => ({ id, building, floor, neighbors: [], markers });

describe("elevatorEdges", () => {
  it("connects two landings of the same elevator", () => {
    const nodes = [
      node("f1", 1, [elevatorMarker("m1", "E1", [1, 2])]),
      node("f2", 2, [elevatorMarker("m2", "E1", [1, 2])]),
    ];
    expect(elevatorEdges(nodes)).toEqual([{ a: "f1", b: "f2", elevatorId: "E1" }]);
  });

  it("does not connect landings on the same floor (a landing per floor is enforced elsewhere, but stay defensive)", () => {
    const nodes = [
      node("f1a", 1, [elevatorMarker("m1", "E1", [1, 2])]),
      node("f1b", 1, [elevatorMarker("m2", "E1", [1, 2])]),
    ];
    expect(elevatorEdges(nodes)).toEqual([]);
  });

  it("does not connect landings with different elevatorIds", () => {
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

  it("a landing on a floor the elevator no longer serves is defensively excluded", () => {
    // Shouldn't happen (the backend refuses dropping a served floor with a
    // landing on it), but the graph shouldn't connect it if it ever does.
    const nodes = [
      node("f1", 1, [elevatorMarker("m1", "E1", [1])]), // 2 dropped from accessibleFloors
      node("f2", 2, [elevatorMarker("m2", "E1", [1])]),
    ];
    expect(elevatorEdges(nodes)).toEqual([]);
  });

  it("ignores non-elevator markers and markers with no elevatorId", () => {
    const nodes = [
      node("f1", 1, [{ id: "m1", type: "room", label: "R", yaw: 0, pitch: 0 }]),
      node("f2", 2, [elevatorMarker("m2", "", [1, 2])]),
    ];
    expect(elevatorEdges(nodes)).toEqual([]);
  });
});

describe("elevatorDestinationsFrom", () => {
  it("returns every other floor's landing, lowest first, excluding this node's own", () => {
    const nodes = [
      node("f1", 1, [elevatorMarker("m1", "E1", [1, 2, 3])]),
      node("f3", 3, [elevatorMarker("m3", "E1", [1, 2, 3])]),
      node("f2", 2, [elevatorMarker("m2", "E1", [1, 2, 3])]),
    ];
    const dest = elevatorDestinationsFrom(nodes, "f1", "E1").map((d) => d.node.id);
    expect(dest).toEqual(["f2", "f3"]);
  });

  it("is empty for an elevator this node has no landing for", () => {
    const nodes = [node("f1", 1, [elevatorMarker("m1", "E1", [1, 2])]), node("f2", 2, [elevatorMarker("m2", "E1", [1, 2])])];
    expect(elevatorDestinationsFrom(nodes, "f1", "OTHER")).toEqual([]);
  });
});

describe("elevatorRideBetween", () => {
  it("identifies a ride and its arrival floor", () => {
    const nodes = [
      node("f1", 1, [elevatorMarker("m1", "E1", [1, 2], 90)]),
      node("f2", 2, [elevatorMarker("m2", "E1", [1, 2], 270)]),
    ];
    const ride = elevatorRideBetween(nodes, "f1", "f2");
    expect(ride.toFloor).toBe(2);
    expect(ride.toMarker.id).toBe("m2");
  });

  it("is null for two nodes that aren't an elevator connection", () => {
    const nodes = [node("f1", 1), node("f2", 2)];
    expect(elevatorRideBetween(nodes, "f1", "f2")).toBeNull();
  });
});

describe("arrivalYawFromLanding", () => {
  it("faces the opposite way from the landing marker's own facing", () => {
    expect(arrivalYawFromLanding({ yaw: 90 })).toBe(270);
    expect(arrivalYawFromLanding({ yaw: 300 })).toBe(120);
  });
});

describe("validateElevator", () => {
  const opts = { buildingFloors: [-1, 1, 2, 3], existingIds: ["e1"], isNew: true };

  it("requires an id, unused, on a new elevator", () => {
    expect(validateElevator({ id: "", label: "A", building: "gd1", accessibleFloors: [1, 2] }, opts).length).toBeGreaterThan(0);
    expect(validateElevator({ id: "e1", label: "A", building: "gd1", accessibleFloors: [1, 2] }, opts).length).toBeGreaterThan(0);
  });

  it("does not require a unique id check when editing", () => {
    const errors = validateElevator(
      { id: "e1", label: "A", building: "gd1", accessibleFloors: [1, 2] },
      { ...opts, isNew: false }
    );
    expect(errors).toEqual([]);
  });

  it("requires a label, a building, and at least 2 floors within the building", () => {
    expect(validateElevator({ id: "e2", label: "", building: "gd1", accessibleFloors: [1, 2] }, opts).length).toBeGreaterThan(0);
    expect(validateElevator({ id: "e2", label: "A", building: "", accessibleFloors: [1, 2] }, opts).length).toBeGreaterThan(0);
    expect(validateElevator({ id: "e2", label: "A", building: "gd1", accessibleFloors: [1] }, opts).length).toBeGreaterThan(0);
    expect(validateElevator({ id: "e2", label: "A", building: "gd1", accessibleFloors: [1, 9] }, opts).length).toBeGreaterThan(0);
  });

  it("passes a valid new elevator", () => {
    expect(validateElevator({ id: "e2", label: "A", building: "gd1", accessibleFloors: [1, 2] }, opts)).toEqual([]);
  });
});

describe("validateElevatorLanding", () => {
  const elevator = { id: "E1", building: "gd1", accessibleFloors: [1, 2], landings: [{ nodeId: "f1", floor: 1 }] };

  it("requires an elevator", () => {
    expect(validateElevatorLanding(null, node("f2", 2)).length).toBeGreaterThan(0);
  });

  it("rejects a different building", () => {
    expect(validateElevatorLanding(elevator, node("f2", 2, [], "gd2")).length).toBeGreaterThan(0);
  });

  it("rejects a floor the elevator doesn't serve", () => {
    expect(validateElevatorLanding(elevator, node("f3", 3)).length).toBeGreaterThan(0);
  });

  it("rejects a second landing on a floor that already has one", () => {
    expect(validateElevatorLanding(elevator, node("otherF1", 1)).length).toBeGreaterThan(0);
  });

  it("passes a fresh floor in the right building", () => {
    expect(validateElevatorLanding(elevator, node("f2", 2))).toEqual([]);
  });
});

describe("floorsWithLandingsDropped", () => {
  it("names landings on floors being removed", () => {
    const elevator = {
      accessibleFloors: [1, 2, 3],
      landings: [{ nodeId: "f1", floor: 1 }, { nodeId: "f2", floor: 2 }],
    };
    expect(floorsWithLandingsDropped(elevator, [1, 3])).toEqual([{ nodeId: "f2", floor: 2 }]);
    expect(floorsWithLandingsDropped(elevator, [1, 2, 3])).toEqual([]);
  });
});
