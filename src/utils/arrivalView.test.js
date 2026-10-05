import { describe, it, expect } from "vitest";
import { arrivalView } from "./arrivalView";

const arrival = { hotspots: { a: { yaw: 100, pitch: 5 } } };

describe("arrivalView", () => {
  it("a manual default view wins over everything", () => {
    expect(arrivalView({ yaw: 10, defaultYaw: 40, defaultPitch: 7 }, arrival, "a")).toEqual({
      yaw: 40,
      pitch: 7,
      source: "manual",
    });
  });

  it("a manual default of 0 still counts as manual", () => {
    expect(arrivalView({ yaw: 10, defaultYaw: 0 }, arrival, "a")).toEqual({ yaw: 0, pitch: 0, source: "manual" });
  });

  it("without a manual view, faces away from the arrival's return arrow", () => {
    expect(arrivalView({ yaw: 10 }, arrival, "a")).toEqual({ yaw: 280, pitch: 0, source: "automatic" });
  });

  it("wraps past 360", () => {
    const node = { hotspots: { a: { yaw: 270 } } };
    expect(arrivalView({}, node, "a").yaw).toBe(90);
  });

  it("falls back to the clicked arrow when the arrival has no placed return arrow", () => {
    expect(arrivalView({ yaw: 10 }, { hotspots: {} }, "a")).toEqual({ yaw: 10, pitch: 0, source: "arrow" });
    expect(arrivalView({ yaw: 10 }, undefined, "a").source).toBe("arrow");
    expect(arrivalView({ yaw: 10 }, arrival, null).source).toBe("arrow");
  });

  it("faces forward when nothing is known", () => {
    expect(arrivalView(undefined, undefined, undefined)).toEqual({ yaw: 0, pitch: 0, source: "arrow" });
  });
});
