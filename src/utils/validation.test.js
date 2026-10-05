import { describe, it, expect } from "vitest";
import { validateNode } from "./validation";

const fireMarker = { id: 1, type: "emergency_exit", label: "Emergency Exit", yaw: 0, pitch: 0, landings: [] };

const node = (extra = {}) => ({
  id: "gd1_f1_entrance01", name: "Main Door", building: "gd1", floor: 1, type: "entrance", rooms: [], ...extra,
});

describe("validateNode: Emergency Exit Destination Point tick", () => {
  it("accepts the tick on Open Area, Parking, Lobby and Entrance nodes on Floor 1", () => {
    for (const type of ["open_area", "parking", "lobby", "entrance"]) {
      const n = node({ id: `gd1_f1_${type}01`, type, isEmergencyDestination: true });
      expect(validateNode(n, [])).toEqual([]);
    }
  });

  it("accepts it on a node of any type that carries an Emergency Exit marker (a fire door)", () => {
    const door = node({ id: "gd1_f1_hallway01", type: "hallway", isEmergencyDestination: true, markers: [fireMarker] });
    expect(validateNode(door, [])).toEqual([]);
  });

  it("accepts it Underground, and refuses it on any upper floor", () => {
    expect(validateNode(node({ id: "gd1_f-1_parking01", floor: -1, type: "parking", isEmergencyDestination: true }), [])).toEqual([]);
    const upper = node({ id: "gd1_f2_lobby01", floor: 2, type: "lobby", isEmergencyDestination: true });
    expect(validateNode(upper, [])).toEqual([expect.stringMatching(/Floor 1 or Underground/)]);
  });

  it("refuses it on any other type without the marker", () => {
    for (const type of ["hallway", "stairs", "building_transition"]) {
      const n = node({ id: `gd1_f1_${type}01`, type, isEmergencyDestination: true });
      expect(validateNode(n, [])).toEqual([expect.stringMatching(/Only Open Area, Parking, Lobby and Entrance/)]);
    }
  });

  it("asks nothing of Stairs nodes: the floors they reach come from their links", () => {
    expect(validateNode(node({ id: "gd1_f1_stairs01", type: "stairs" }), [])).toEqual([]);
  });

  it("is fine without the tick", () => {
    expect(validateNode(node({ id: "gd1_f1_hallway01", type: "hallway" }), [])).toEqual([]);
  });
});
