import { describe, it, expect } from "vitest";
import { validateNode } from "./validation";

const node = (extra = {}) => ({
  id: "gd1_f1_entrance01", name: "Main Door", building: "gd1", floor: 1, type: "entrance", rooms: [], ...extra,
});

describe("validateNode: Emergency Exit Destination Point tick", () => {
  it("accepts the tick on Open Area, Parking, Lobby, Entrance and Fire Exit nodes on Floor 1", () => {
    for (const type of ["open_area", "parking", "lobby", "entrance", "fire_exit"]) {
      const n = node({ id: `gd1_f1_${type}01`, type, leadsToFloors: [2], isEmergencyDestination: true });
      expect(validateNode(n, [])).toEqual([]);
    }
  });

  it("accepts it Underground, and refuses it on any upper floor", () => {
    expect(validateNode(node({ id: "gd1_f-1_parking01", floor: -1, type: "parking", isEmergencyDestination: true }), [])).toEqual([]);
    const upper = node({ id: "gd1_f2_lobby01", floor: 2, type: "lobby", isEmergencyDestination: true });
    expect(validateNode(upper, [])).toEqual([expect.stringMatching(/Floor 1 or Underground/)]);
  });

  it("refuses it on any other type", () => {
    for (const type of ["hallway", "stairs", "building_transition"]) {
      const n = node({ id: `gd1_f1_${type}01`, type, leadsToFloors: [2], isEmergencyDestination: true });
      expect(validateNode(n, [])).toEqual([expect.stringMatching(/Only Open Area, Parking, Lobby, Entrance and Fire Exit/)]);
    }
  });

  it("lets a ticked Fire Exit skip the floors, since a door has none", () => {
    const door = node({ id: "gd1_f1_fire_exit01", type: "fire_exit", leadsToFloors: [], isEmergencyDestination: true });
    expect(validateNode(door, [])).toEqual([]);
  });

  it("still requires floors from an unticked Fire Exit and from Stairs", () => {
    const stairwell = node({ id: "gd1_f1_fire_exit01", type: "fire_exit", leadsToFloors: [] });
    expect(validateNode(stairwell, [])).toEqual([expect.stringMatching(/must specify at least one floor/)]);
    const stairs = node({ id: "gd1_f1_stairs01", type: "stairs", leadsToFloors: [] });
    expect(validateNode(stairs, [])).toEqual([expect.stringMatching(/must specify at least one floor/)]);
  });

  it("is fine without the tick", () => {
    expect(validateNode(node({ id: "gd1_f1_hallway01", type: "hallway" }), [])).toEqual([]);
  });
});
