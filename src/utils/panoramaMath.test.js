import { describe, it, expect } from "vitest";
import {
  MARKER_RADIUS,
  isFacing,
  previewScale,
  autoPanStep,
  PREVIEW_MAX_SCALE,
  PREVIEW_MIN_SCALE,
  PREVIEW_FALLOFF_DEG,
  AUTO_PAN_MIN_DEG_PER_SEC,
  AUTO_PAN_MAX_DEG_PER_SEC,
  TARGET_HORIZONTAL_FOV,
  MIN_FOV,
  MAX_FOV,
  toPosition,
  toAngles,
  initialCameraPosition,
  computeFov,
  zoomedFov,
  clampZoom,
  MIN_ZOOM,
  MAX_ZOOM,
  overlayScale,
  angleBetween,
  isInViewport,
  closestHotspotInView,
} from "./panoramaMath";

const close = (actual, expected) => actual.forEach((v, i) => expect(v).toBeCloseTo(expected[i], 6));

describe("toPosition", () => {
  it("yaw 0 points along -Z", () => close(toPosition(0, 0, 10), [0, 0, -10]));
  it("yaw 90 points along +X", () => close(toPosition(90, 0, 10), [10, 0, 0]));
  it("pitch 90 points straight up", () => close(toPosition(0, 90, 10), [0, 10, 0]));
  it("defaults to the marker radius", () => {
    const [x, y, z] = toPosition(30, 20);
    expect(Math.sqrt(x * x + y * y + z * z)).toBeCloseTo(MARKER_RADIUS, 6);
  });
});

describe("toAngles", () => {
  it("inverts toPosition", () => {
    for (const [yaw, pitch] of [[0, 0], [90, 10], [200, -30], [359, 45]]) {
      const [x, y, z] = toPosition(yaw, pitch, 500);
      const back = toAngles({ x, y, z });
      expect(back.yaw).toBeCloseTo(yaw, 6);
      expect(back.pitch).toBeCloseTo(pitch, 6);
    }
  });
  it("keeps yaw in 0-360", () => {
    expect(toAngles({ x: -1, y: 0, z: 0 }).yaw).toBeCloseTo(270, 6);
  });
});

describe("initialCameraPosition", () => {
  it("sits opposite the direction to face", () => {
    const [x, y, z] = initialCameraPosition(0, 0);
    expect(x).toBeCloseTo(0, 6);
    expect(y).toBeCloseTo(0, 6);
    expect(z).toBeCloseTo(0.1, 6); // facing -Z means standing on the +Z side
  });
});

describe("computeFov", () => {
  it("falls back to the target when the size is unknown", () => {
    expect(computeFov(0, 800)).toBe(TARGET_HORIZONTAL_FOV);
    expect(computeFov(800, 0)).toBe(TARGET_HORIZONTAL_FOV);
  });
  it("a wide screen needs a small vertical FOV, clamped at the minimum", () => {
    expect(computeFov(3000, 500)).toBe(MIN_FOV);
  });
  it("a tall, narrow screen needs a large vertical FOV, approaching but never past the maximum", () => {
    // The vertical angle for a fixed horizontal one only approaches 180°
    // as the screen narrows, so the MAX_FOV clamp is a safety net.
    const fov = computeFov(300, 1200);
    expect(fov).toBeGreaterThan(150);
    expect(fov).toBeLessThanOrEqual(MAX_FOV);
  });
  it("a 16:9 landscape screen lands between the clamps", () => {
    const fov = computeFov(1920, 1080);
    expect(fov).toBeGreaterThan(MIN_FOV);
    expect(fov).toBeLessThan(MAX_FOV);
  });
  it("keeps the same horizontal view: a square screen's vertical FOV equals the target", () => {
    expect(computeFov(800, 800)).toBeCloseTo(TARGET_HORIZONTAL_FOV, 6);
  });
});

describe("overlayScale", () => {
  const scaleFor = (w, h) => overlayScale(w, h, computeFov(w, h));
  it("is 1 at the 1920x1080 reference desktop", () => {
    expect(scaleFor(1920, 1080)).toBeCloseTo(1, 6);
  });
  it("stays 1 for any screen of the same shape (window resizes)", () => {
    // Scene units already scale with the canvas height at a fixed FOV, so a
    // smaller window of the same shape needs no correction.
    expect(scaleFor(1280, 720)).toBeCloseTo(1, 6);
    expect(scaleFor(960, 540)).toBeCloseTo(1, 6);
  });
  it("is larger on a tall kiosk, where the wide vertical FOV shrinks things", () => {
    expect(scaleFor(1080, 1152)).toBeGreaterThan(1.5);
  });
  it("falls back to 1 without a size or FOV", () => {
    expect(overlayScale(0, 0, 90)).toBe(1);
    expect(overlayScale(800, 600, 0)).toBe(1);
  });
});

describe("pinch zoom", () => {
  it("leaves the base FOV alone at zoom 1", () => {
    expect(zoomedFov(100, 1)).toBeCloseTo(100);
  });

  it("narrows the FOV when zooming in and widens it when zooming out", () => {
    expect(zoomedFov(100, 2)).toBeLessThan(100);
    expect(zoomedFov(100, 0.8)).toBeGreaterThan(100);
  });

  it("clamps the zoom, and keeps the FOV out of fisheye territory", () => {
    expect(clampZoom(99)).toBe(MAX_ZOOM);
    expect(clampZoom(0)).toBe(MIN_ZOOM);
    expect(zoomedFov(170, MIN_ZOOM)).toBeLessThanOrEqual(165);
  });
});

describe("isFacing and previewScale", () => {
  it("counts a hotspot as facing until it is about 78° off the view", () => {
    expect(isFacing(1)).toBe(true);
    expect(isFacing(Math.cos((70 * Math.PI) / 180))).toBe(true);
    expect(isFacing(Math.cos((85 * Math.PI) / 180))).toBe(false);
    expect(isFacing(-1)).toBe(false);
  });

  it("scales the preview from full size straight ahead down to the minimum", () => {
    expect(previewScale(1)).toBeCloseTo(PREVIEW_MAX_SCALE);
    expect(previewScale(Math.cos((PREVIEW_FALLOFF_DEG * Math.PI) / 180))).toBeCloseTo(PREVIEW_MIN_SCALE);
    expect(previewScale(-1)).toBeCloseTo(PREVIEW_MIN_SCALE);
    const half = previewScale(Math.cos(((PREVIEW_FALLOFF_DEG / 2) * Math.PI) / 180));
    expect(half).toBeCloseTo((PREVIEW_MAX_SCALE + PREVIEW_MIN_SCALE) / 2);
  });

  it("tolerates a dot product nudged past ±1 by rounding", () => {
    expect(previewScale(1.0000001)).toBeCloseTo(PREVIEW_MAX_SCALE);
    expect(previewScale(-1.0000001)).toBeCloseTo(PREVIEW_MIN_SCALE);
  });
});

describe("angleBetween", () => {
  it("is zero for the same direction", () => {
    expect(angleBetween(30, 10, 30, 10)).toBeCloseTo(0, 6);
  });
  it("is 90 degrees for a right-angle turn", () => {
    expect(angleBetween(0, 0, 90, 0)).toBeCloseTo(Math.PI / 2, 6);
  });
  it("is 180 degrees for the opposite direction", () => {
    expect(angleBetween(0, 0, 180, 0)).toBeCloseTo(Math.PI, 6);
  });
});

describe("isInViewport", () => {
  it("is true dead ahead for any FOV", () => {
    expect(isInViewport(0, 0, 0, 0, 50, 35)).toBe(true);
  });

  it("is false just past the horizontal edge", () => {
    expect(isInViewport(0, 0, 51, 0, 50, 35)).toBe(false);
  });

  it("is true just inside the horizontal edge", () => {
    expect(isInViewport(0, 0, 49, 0, 50, 35)).toBe(true);
  });

  it("is false just past the vertical edge", () => {
    expect(isInViewport(0, 0, 0, 36, 50, 35)).toBe(false);
  });

  it("is false directly behind the camera, regardless of a wide FOV", () => {
    expect(isInViewport(0, 0, 180, 0, 89, 89)).toBe(false);
  });

  it("is false off to the side even though it's less than 90 degrees away, once the FOV is narrow", () => {
    // 80° off yaw is still technically "in front" (< 90°), but well outside a 50°-wide view.
    expect(isInViewport(0, 0, 80, 0, 50, 35)).toBe(false);
  });

  it("follows a panned view, not just world-forward", () => {
    expect(isInViewport(90, 0, 100, 0, 50, 35)).toBe(true);
    expect(isInViewport(90, 0, 0, 0, 50, 35)).toBe(false);
  });

  it("handles looking straight up without degenerating", () => {
    expect(isInViewport(0, 90, 0, 90, 50, 35)).toBe(true);
  });
});

describe("closestHotspotInView", () => {
  const hotspots = [
    { id: "front", yaw: 10, pitch: 0 },
    { id: "edge-of-frame", yaw: 40, pitch: 0 },
    { id: "out-of-frame", yaw: 80, pitch: 0 },
    { id: "behind", yaw: 170, pitch: 0 },
  ];

  it("picks whichever hotspot is nearest dead ahead, among those on screen", () => {
    expect(closestHotspotInView(hotspots, 0, 0, 50, 35).id).toBe("front");
  });

  it("ignores a hotspot that's technically in front but off screen", () => {
    const result = closestHotspotInView(hotspots, 0, 0, 50, 35);
    expect(result.id).not.toBe("out-of-frame");
  });

  it("returns null when nothing on screen qualifies", () => {
    expect(closestHotspotInView([{ id: "out-of-frame", yaw: 80, pitch: 0 }], 0, 0, 50, 35)).toBeNull();
  });

  it("returns null with no hotspots at all", () => {
    expect(closestHotspotInView([], 0, 0, 50, 35)).toBeNull();
  });

  it("picks up a hotspot a wider FOV brings into frame", () => {
    expect(closestHotspotInView(hotspots, 0, 0, 85, 60)?.id).toBe("front");
    const wideResult = closestHotspotInView([{ id: "out-of-frame", yaw: 80, pitch: 0 }], 0, 0, 85, 60);
    expect(wideResult?.id).toBe("out-of-frame");
  });
});

describe("autoPanStep", () => {
  const rad = (deg) => (deg * Math.PI) / 180;

  it("stops once within half a degree", () => {
    expect(autoPanStep(rad(0.4), 0.016)).toBe(0);
  });

  it("turns at the floor speed for a small angle and the ceiling for a large one", () => {
    expect(autoPanStep(rad(4), 0.05)).toBeCloseTo(rad(AUTO_PAN_MIN_DEG_PER_SEC * 0.05)); // 4° * 0.5 = 2 → floor
    expect(autoPanStep(rad(120), 0.05)).toBeCloseTo(rad(AUTO_PAN_MAX_DEG_PER_SEC * 0.05)); // 60 → ceiling
  });

  it("eases in between", () => {
    expect(autoPanStep(rad(40), 0.05)).toBeCloseTo(rad(20 * 0.05));
  });

  it("caps a long frame at 0.1s and never overshoots the target", () => {
    expect(autoPanStep(rad(120), 5)).toBeCloseTo(rad(AUTO_PAN_MAX_DEG_PER_SEC * 0.1));
    expect(autoPanStep(rad(1), 5)).toBeCloseTo(rad(AUTO_PAN_MIN_DEG_PER_SEC * 0.1));
    expect(autoPanStep(rad(0.6), 5)).toBeLessThanOrEqual(rad(0.6));
  });
});
