// Renders a normal-looking (rectilinear / perspective) view out of an
// equirectangular 360° photo, so a node's own panorama can be its preview
// instead of the stretched flat map.
//
// Conventions match the viewer (PanoramaNav): directions use panoramaMath's
// toPosition(yaw, pitch), and the pixel a direction lands on is where
// three's SphereGeometry (scaled [-1,1,1], viewed from inside) puts it:
//   column = atan2(z, x) / 2π (mod 1),  row from the top = acos(y) / π

const TWO_PI = Math.PI * 2;

// Source pixel (fractional column/row) for a unit direction.
export function directionToPixel(x, y, z, width, height) {
  let u = Math.atan2(z, x) / TWO_PI;
  if (u < 0) u += 1;
  const v = Math.acos(Math.max(-1, Math.min(1, y))) / Math.PI;
  return [u * width, v * height];
}

/**
 * src: { data: Uint8ClampedArray (RGBA), width, height } — the equirect image.
 * view: { yaw, pitch (degrees), fov (horizontal, degrees), width, height } — the output.
 * Returns an RGBA Uint8ClampedArray of view.width × view.height, bilinearly sampled.
 */
export function projectRectilinear(src, { yaw, pitch = 0, fov = 80, width, height }) {
  const out = new Uint8ClampedArray(width * height * 4);
  const yawRad = (yaw * Math.PI) / 180;
  const pitchRad = (pitch * Math.PI) / 180;

  // Camera basis: forward, right (horizontal), up.
  const fx = Math.sin(yawRad) * Math.cos(pitchRad);
  const fy = Math.sin(pitchRad);
  const fz = -Math.cos(yawRad) * Math.cos(pitchRad);
  const rx = Math.cos(yawRad);
  const rz = Math.sin(yawRad);
  // up = right × forward (right has no y component)
  const ux = -rz * fy;
  const uy = rz * fx - rx * fz;
  const uz = rx * fy;

  const halfW = Math.tan(((fov * Math.PI) / 180) / 2);
  const halfH = (halfW * height) / width;
  const { data, width: sw, height: sh } = src;

  for (let j = 0; j < height; j++) {
    const sy = (1 - (2 * (j + 0.5)) / height) * halfH;
    for (let i = 0; i < width; i++) {
      const sx = ((2 * (i + 0.5)) / width - 1) * halfW;
      let dx = fx + sx * rx + sy * ux;
      let dy = fy + sy * uy;
      let dz = fz + sx * rz + sy * uz;
      const len = Math.hypot(dx, dy, dz);
      dx /= len;
      dy /= len;
      dz /= len;

      const [px, py] = directionToPixel(dx, dy, dz, sw, sh);
      // Bilinear, wrapping horizontally, clamped vertically.
      const x0 = Math.floor(px - 0.5);
      const y0 = Math.floor(py - 0.5);
      const tx = px - 0.5 - x0;
      const ty = py - 0.5 - y0;
      const xa = ((x0 % sw) + sw) % sw;
      const xb = (xa + 1) % sw;
      const ya = Math.max(0, Math.min(sh - 1, y0));
      const yb = Math.max(0, Math.min(sh - 1, y0 + 1));
      const o = (j * width + i) * 4;
      for (let c = 0; c < 3; c++) {
        const top = data[(ya * sw + xa) * 4 + c] * (1 - tx) + data[(ya * sw + xb) * 4 + c] * tx;
        const bottom = data[(yb * sw + xa) * 4 + c] * (1 - tx) + data[(yb * sw + xb) * 4 + c] * tx;
        out[o + c] = top * (1 - ty) + bottom * ty;
      }
      out[o + 3] = 255;
    }
  }
  return out;
}
