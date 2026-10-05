import { describe, it, expect } from "vitest";
import { inventoryMarkers, orphanedFacilityNames } from "./markers";

const node = (over) => ({ id: "n1", name: "Hall", building: "gd1", floor: 1, rooms: [], markers: [], ...over });
const marker = (over) => ({ id: 1, type: "facility", label: "Cafe", yaw: 10, pitch: 5, ...over });

describe("inventoryMarkers", () => {
  it("flattens markers with their node's place data", () => {
    const rows = inventoryMarkers([node({ markers: [marker()] })]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ nodeId: "n1", nodeName: "Hall", building: "gd1", floor: 1, problems: [] });
  });

  it("flags a room marker that matches no room served, ignoring case and punctuation", () => {
    const ok = inventoryMarkers([node({ rooms: ["Room 203"], markers: [marker({ type: "room", label: "room-203" })] })]);
    expect(ok[0].problems).toEqual([]);
    const bad = inventoryMarkers([node({ rooms: ["Room 203"], markers: [marker({ type: "room", label: "Room 204" })] })]);
    expect(bad[0].problems).toEqual(["unmatched-room"]);
  });

  it("flags blank labels and duplicates, and a marker left at the origin", () => {
    const rows = inventoryMarkers([
      node({ markers: [marker({ id: 1, label: "" }), marker({ id: 2 }), marker({ id: 3 }), marker({ id: 4, label: "Lift", yaw: 0, pitch: 0 })] }),
    ]);
    expect(rows[0].problems).toEqual(["blank-label"]);
    expect(rows[1].problems).toEqual(["duplicate"]);
    expect(rows[2].problems).toEqual(["duplicate"]);
    expect(rows[3].problems).toEqual(["origin"]);
  });

  it("flags an emergency exit that leads nowhere: no landings and not a ticked destination", () => {
    const exit = (landings) => marker({ type: "emergency_exit", label: "Emergency Exit", landings });
    const rows = inventoryMarkers([
      node({ id: "n1", markers: [exit([])] }),
      node({ id: "n2", markers: [exit(["n9"])] }),
      node({ id: "n3", isEmergencyDestination: true, markers: [exit([])] }),
    ]);
    expect(rows.map((r) => r.problems)).toEqual([["exit-no-landing"], [], []]);
  });

  it("checks elevator landings against their Elevator record", () => {
    const elevators = [{ id: "e1", label: "Lift A", accessibleFloors: [2, 3] }];
    const landing = (elevatorId) => marker({ type: "elevator", label: "", elevatorId });
    const rows = inventoryMarkers([node({ floor: 1, markers: [landing("e1")] }), node({ id: "n2", floor: 2, markers: [landing("e1")] }), node({ id: "n3", markers: [landing("gone")] })], elevators);
    expect(rows[0].problems).toEqual(["floor-not-served"]);
    expect(rows[1].problems).toEqual([]);
    expect(rows[1].label).toBe("Lift A");
    expect(rows[2].problems).toEqual(["no-elevator"]);
  });
});

describe("facility no-details check", () => {
  const facility = (label) => marker({ type: "facility", label });
  it("flags a facility with no record or an empty one, but not one with details", () => {
    const n = node({ markers: [facility("Cafe"), facility("Clinic"), facility("Gym")] });
    const records = { Clinic: { roomDescription: "", link: "" }, Gym: { department: "Sports" } };
    const rows = inventoryMarkers([n], [], (name) => records[name] || null);
    expect(rows.map((r) => r.problems.includes("no-details"))).toEqual([true, true, false]);
  });
  it("skips the check without a details lookup, and for rooms", () => {
    expect(inventoryMarkers([node({ markers: [facility("Cafe")] })])[0].problems).toEqual([]);
    expect(inventoryMarkers([node({ rooms: ["A"], markers: [marker({ type: "room", label: "A" })] })], [], () => null)[0].problems).toEqual([]);
  });
});

describe("orphanedFacilityNames", () => {
  const f = (id, label) => ({ id, type: "facility", label, yaw: 1, pitch: 1 });
  const before = [node({ markers: [f(1, "Cafe"), f(2, "Clinic")] }), node({ id: "n2", rooms: ["Lab"], markers: [f(3, "Lab")] })];

  it("returns a removed facility's name", () => {
    const after = [{ ...before[0], markers: [f(2, "Clinic")] }, before[1]];
    expect(orphanedFacilityNames(before, after)).toEqual(["Cafe"]);
  });
  it("does not treat a relabel as a removal", () => {
    const after = [{ ...before[0], markers: [f(1, "Canteen"), f(2, "Clinic")] }, before[1]];
    expect(orphanedFacilityNames(before, after)).toEqual([]);
  });
  it("keeps a name another room or facility still uses", () => {
    const after = [{ ...before[0], markers: [f(2, "Clinic")] }, { ...before[1], markers: [] }];
    expect(orphanedFacilityNames(before, after)).toEqual(["Cafe"]); // Lab is still a room on n2
    const twin = [node({ markers: [f(1, "Cafe")] }), node({ id: "n3", markers: [f(9, "cafe")] })];
    expect(orphanedFacilityNames(twin, [twin[1]])).toEqual([]);
  });
  it("returns every facility of a deleted node", () => {
    expect(orphanedFacilityNames(before, [before[1]]).sort()).toEqual(["Cafe", "Clinic"]);
  });
});
