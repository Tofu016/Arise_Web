import { describe, it, expect } from "vitest";
import { previewShown, resolveHotspotClick } from "./hotspotPreview";

const base = { previewHidden: false, clicked: false, facing: true, alwaysPreview: false, hovered: false };

describe("previewShown", () => {
  it("shows on hover, or always on the kiosk", () => {
    expect(previewShown({ ...base, hovered: true })).toBe(true);
    expect(previewShown({ ...base, alwaysPreview: true })).toBe(true);
    expect(previewShown(base)).toBe(false);
  });

  it("never shows behind the camera, once used to leave, or under an overlay", () => {
    for (const blocker of [{ facing: false }, { clicked: true }, { previewHidden: true }]) {
      expect(previewShown({ ...base, hovered: true, alwaysPreview: true, ...blocker })).toBe(false);
    }
  });
});

describe("resolveHotspotClick", () => {
  it("a first touch tap peeks; a second goes", () => {
    expect(resolveHotspotClick({ isTouch: true, hovered: false, alwaysPreview: false })).toBe("peek");
    expect(resolveHotspotClick({ isTouch: true, hovered: true, alwaysPreview: false })).toBe("go");
  });

  it("goes at once with a mouse, or on the kiosk where the preview is always up", () => {
    expect(resolveHotspotClick({ isTouch: false, hovered: false, alwaysPreview: false })).toBe("go");
    expect(resolveHotspotClick({ isTouch: true, hovered: false, alwaysPreview: true })).toBe("go");
  });
});
