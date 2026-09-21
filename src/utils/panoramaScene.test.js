import { describe, it, expect } from "vitest";
import { resolveScene } from "./panoramaScene";

const props = { hotspots: ["new-h"], markers: ["new-m"] };
const shown = { key: "a", texture: {}, hotspots: ["old-h"], markers: ["old-m"] };

describe("resolveScene", () => {
  it("shows the live props once the loaded scene is the one being asked for", () => {
    const r = resolveScene({ holdsScene: true, key: "a", shown, ...props });
    expect(r).toMatchObject({ live: true, visible: shown, hotspots: ["new-h"], markers: ["new-m"], sceneKey: "a" });
  });

  it("keeps the scene being left, with its own hotspots and markers, until the new photo loads", () => {
    const r = resolveScene({ holdsScene: true, key: "b", shown, ...props });
    expect(r).toMatchObject({ live: false, visible: shown, hotspots: ["old-h"], markers: ["old-m"], sceneKey: "a" });
  });

  it("is live with nothing yet loaded", () => {
    const r = resolveScene({ holdsScene: true, key: "a", shown: null, ...props });
    expect(r).toMatchObject({ live: true, visible: null, hotspots: ["new-h"], sceneKey: "a" });
  });

  it("without a held scene, only draws the photo for the current url", () => {
    expect(resolveScene({ holdsScene: false, key: "b", shown, ...props })).toMatchObject({ live: true, visible: null, hotspots: ["new-h"] });
    expect(resolveScene({ holdsScene: false, key: "a", shown, ...props }).visible).toBe(shown);
  });
});
