import { describe, it, expect } from "vitest";
import { directionToPixel, projectRectilinear } from "./rectilinear";
import { toPosition } from "./panoramaMath";

// A 8×4 equirect image whose red channel encodes the column and green the row.
function makeSource(width = 8, height = 4) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      data[o] = x * 30;
      data[o + 1] = y * 60;
      data[o + 2] = 0;
      data[o + 3] = 255;
    }
  }
  return { data, width, height };
}

describe("directionToPixel", () => {
  it("matches the viewer's sphere mapping: yaw 0 (-Z) is 3/4 across the image", () => {
    const [x, y, z] = toPosition(0, 0, 1);
    const [px, py] = directionToPixel(x, y, z, 8, 4);
    expect(px).toBeCloseTo(6, 6);
    expect(py).toBeCloseTo(2, 6); // horizon is the middle row
  });
  it("yaw 90 (+X) is the left edge (wraps to 0)", () => {
    const [x, y, z] = toPosition(90, 0, 1);
    const [px] = directionToPixel(x, y, z, 8, 4);
    expect(Math.min(px, 8 - px)).toBeCloseTo(0, 6);
  });
  it("straight up is the top row", () => {
    const [, py] = directionToPixel(0, 1, 0, 8, 4);
    expect(py).toBeCloseTo(0, 6);
  });
});

describe("projectRectilinear", () => {
  it("the centre pixel samples the source at the look direction", () => {
    const src = makeSource();
    // Odd output size so a pixel sits exactly on the optical axis.
    const out = projectRectilinear(src, { yaw: 0, pitch: 0, fov: 60, width: 5, height: 5 });
    const centre = (2 * 5 + 2) * 4;
    // Source column 6 / row 2 hold red = 180, green = 120 (bilinear at
    // exact pixel-centre boundaries blends neighbours, so allow slack).
    expect(out[centre]).toBeGreaterThan(150);
    expect(out[centre]).toBeLessThan(210);
    expect(out[centre + 1]).toBeGreaterThan(80);
    expect(out[centre + 1]).toBeLessThan(160);
    expect(out[centre + 3]).toBe(255);
  });
  it("returns an opaque RGBA buffer of the requested size", () => {
    const out = projectRectilinear(makeSource(), { yaw: 123, pitch: 10, fov: 80, width: 6, height: 4 });
    expect(out.length).toBe(6 * 4 * 4);
    for (let i = 3; i < out.length; i += 4) expect(out[i]).toBe(255);
  });
  it("looking the opposite way samples the opposite column", () => {
    const src = makeSource();
    const a = projectRectilinear(src, { yaw: 0, fov: 10, width: 3, height: 3 });
    const b = projectRectilinear(src, { yaw: 180, fov: 10, width: 3, height: 3 });
    expect(Math.abs(a[(4) * 4] - b[(4) * 4])).toBeGreaterThan(60); // red differs by ~half the image
  });
});
