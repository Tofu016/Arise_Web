import { describe, it, expect } from "vitest";
import { pinchedZoom, stepZoom, PINCH_ZOOM_SNAP } from "./useZoom";
import { MIN_ZOOM, MAX_ZOOM } from "../../utils/panoramaMath";

describe("pinchedZoom", () => {
  it("scales the starting zoom by the change in finger distance", () => {
    expect(pinchedZoom(1, 2)).toBeCloseTo(2);
    expect(pinchedZoom(2, 0.75)).toBeCloseTo(1.5);
  });

  it("clamps to the zoom range", () => {
    expect(pinchedZoom(2, 10)).toBe(MAX_ZOOM);
    expect(pinchedZoom(1, 0.1)).toBe(MIN_ZOOM);
  });

  it("holds at exactly 1 inside the detent, from either side", () => {
    expect(pinchedZoom(2, 0.52)).toBe(1); // 1.04
    expect(pinchedZoom(0.8, 1.2)).toBe(1); // 0.96
    expect(pinchedZoom(1, 1 + PINCH_ZOOM_SNAP / 2)).toBe(1);
  });

  it("leaves the detent once the pinch pushes past it", () => {
    expect(pinchedZoom(1, 1 + PINCH_ZOOM_SNAP * 1.5)).toBeGreaterThan(1);
    expect(pinchedZoom(1, 1 - PINCH_ZOOM_SNAP * 1.5)).toBeLessThan(1);
  });
});

describe("stepZoom", () => {
  it("lands on 1 when a step would cross it", () => {
    expect(stepZoom(0.9, 1)).toBe(1);
    expect(stepZoom(1.1, -1)).toBe(1);
  });
});
