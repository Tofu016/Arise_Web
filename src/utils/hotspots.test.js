import { describe, it, expect } from "vitest";
import { buildHotspots } from "./hotspots";

const byId = {
  b: { id: "b", name: "Lobby", photo: "b.jpg" },
  c: { id: "c", name: "Lab", photo: "c.jpg" },
};

describe("buildHotspots", () => {
  it("uses a saved angle when there is one", () => {
    const node = { neighbors: ["b"], hotspots: { b: { yaw: 90, pitch: 5 } } };
    expect(buildHotspots(node, byId)).toEqual([{ id: "b", name: "Lobby", yaw: 90, pitch: 5 }]);
  });

  it("carries a saved edge's default arrival view through onto the hotspot", () => {
    const node = { neighbors: ["b"], hotspots: { b: { yaw: 90, pitch: 5, defaultYaw: 10, defaultPitch: -2 } } };
    expect(buildHotspots(node, byId)[0]).toMatchObject({ defaultYaw: 10, defaultPitch: -2 });
  });

  it("spreads links with no saved angle evenly around the circle", () => {
    const hs = buildHotspots({ neighbors: ["b", "c"] }, byId);
    expect(hs.map((h) => h.yaw)).toEqual([0, 180]);
    expect(hs.every((h) => h.pitch === -10)).toBe(true);
  });

  it("falls back to the id when the neighbor isn't loaded", () => {
    expect(buildHotspots({ neighbors: ["ghost"] }, byId)[0].name).toBe("ghost");
  });

  it("adds each neighbor's photo only when asked (the hover sneak-peek)", () => {
    expect(buildHotspots({ neighbors: ["b"] }, byId)[0]).not.toHaveProperty("photo");
    expect(buildHotspots({ neighbors: ["b"] }, byId, { withPhoto: true })[0].photo).toBe("b.jpg");
  });

  it("has no hotspots without neighbors", () => {
    expect(buildHotspots({}, byId)).toEqual([]);
  });
});
