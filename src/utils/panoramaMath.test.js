import { describe, it, expect } from "vitest";
import {
  MARKER_RADIUS,
  TARGET_HORIZONTAL_FOV,
  MIN_FOV,
  MAX_FOV,
  toPosition,
  toAngles,
  initialCameraPosition,
  computeFov,
  overlayScale,
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
