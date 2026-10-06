import { describe, it, expect } from "vitest";
import { markersAfterSave } from "./roomMarkers";

const node = {
  markers: [
    { id: "m1", type: "room", label: "203", yaw: 10, pitch: 0 },
    { id: "m2", type: "facility", label: "Clinic", yaw: 40, pitch: -5 },
    { id: "m3", type: "facility", label: "clinic", yaw: 90, pitch: 0 },
  ],
};

describe("markersAfterSave", () => {
  it("returns null when nothing about the markers changes", () => {
    expect(markersAfterSave(node, { kind: "room", oldName: "203" })).toBeNull();
    expect(markersAfterSave(node, { kind: "room", oldName: "204" })).toBeNull();
  });

  it("moves the first matching marker and relabels every match on a rename", () => {
    const next = markersAfterSave(node, { kind: "facility", oldName: "Clinic", newName: "Infirmary", placement: { yaw: 1, pitch: 2 } });
    expect(next.find((m) => m.id === "m2")).toMatchObject({ label: "Infirmary", yaw: 1, pitch: 2 });
    expect(next.find((m) => m.id === "m3")).toMatchObject({ label: "Infirmary", yaw: 90 });
    expect(next.find((m) => m.id === "m1")).toBe(node.markers[0]);
  });

  it("adds a marker for a room that has none when one is placed", () => {
    const next = markersAfterSave(node, { kind: "room", oldName: null, newName: "205", placement: { yaw: 5, pitch: 6 } });
    expect(next).toHaveLength(4);
    expect(next[3]).toMatchObject({ type: "room", label: "205", yaw: 5, pitch: 6 });
    expect(next[3].id).toBeTruthy();
  });

  it("removes the room's markers when it leaves the node", () => {
    expect(markersAfterSave(node, { kind: "room", oldName: "203", remove: true }).map((m) => m.id)).toEqual(["m2", "m3"]);
    expect(markersAfterSave(node, { kind: "room", oldName: "999", remove: true })).toBeNull();
  });
});
