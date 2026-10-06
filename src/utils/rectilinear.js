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

// Where a view direction (yaw, pitch in degrees) sits on the equirect photo, as
// fractions 0..1 from its left and top edges; the inverse of the pair below.
export function anglesToEquirect(yaw, pitch) {
  const u = (((yaw - 90) / 360) % 1 + 1) % 1;
  return [u, (90 - pitch) / 180];
}

// The view direction under a point of the equirect photo (fractions 0..1),
// yaw in (-180, 180] and pitch in [-90, 90].
export function equirectToAngles(u, v) {
  let yaw = u * 360 + 90;
  if (yaw > 180) yaw -= 360;
  return [yaw, 90 - v * 180];
}

// Camera basis for a view looking along (yaw, pitch): forward, right
// (horizontal) and up.
function viewBasis(yaw, pitch) {
  const yawRad = (yaw * Math.PI) / 180;
  const pitchRad = (pitch * Math.PI) / 180;
  const fx = Math.sin(yawRad) * Math.cos(pitchRad);
  const fy = Math.sin(pitchRad);
  const fz = -Math.cos(yawRad) * Math.cos(pitchRad);
  const rx = Math.cos(yawRad);
  const rz = Math.sin(yawRad);
  // up = right × forward (right has no y component)
  return { fx, fy, fz, rx, rz, ux: -rz * fy, uy: rz * fx - rx * fz, uz: rx * fy };
}

// A flat view { yaw, pitch, fov (horizontal), aspect (height / width of the
// picture) } is a curved region on the equirect map: it bows more the further
// from the horizon it looks. This is where a point of that view lands, as
// fractions of the map, for sx, sy in -1..1 across and up the picture's half
// width and half height. The column is continued past the map's edge (rather
// than wrapped) so a region crossing the seam stays in one piece.
export function viewPoint({ yaw, pitch, fov, aspect }, sx, sy) {
  const { fx, fy, fz, rx, rz, ux, uy, uz } = viewBasis(yaw, pitch);
  const halfW = Math.tan((fov * Math.PI) / 360);
  const a = sx * halfW;
  const b = sy * halfW * aspect;
  const x = fx + a * rx + b * ux;
  const y = fy + b * uy;
  const z = fz + a * rz + b * uz;
  const [px, py] = directionToPixel(x / Math.hypot(x, y, z), y / Math.hypot(x, y, z), z / Math.hypot(x, y, z), 1, 1);
  const [centerU] = anglesToEquirect(yaw, pitch);
  return [centerU + ((((px - centerU) % 1) + 1.5) % 1) - 0.5, py];
}

// The region's outline, clockwise from the top left, as points on the map.
export function viewOutline(view, steps = 12) {
  const corners = [[-1, 1], [1, 1], [1, -1], [-1, -1]];
  const points = [];
  corners.forEach(([ax, ay], i) => {
    const [bx, by] = corners[(i + 1) % 4];
    for (let k = 0; k < steps; k++) {
      points.push(viewPoint(view, ax + ((bx - ax) * k) / steps, ay + ((by - ay) * k) / steps));
    }
  });
  return points;
}

// The width and height, as fractions of the map, of the box around the region.
export function viewBounds(view) {
  const points = viewOutline(view);
  const us = points.map((p) => p[0]);
  const vs = points.map((p) => p[1]);
  return { width: Math.max(...us) - Math.min(...us), height: Math.max(...vs) - Math.min(...vs) };
}

// The field of view a view keeping its center and shape would need to reach
// the map point (u, v) with its edge: how far out that point is across or up
// the picture, whichever is larger. null when the point is behind the view.
export function viewFovAt({ yaw, pitch, aspect }, u, v) {
  const { fx, fy, fz, rx, rz, ux, uy, uz } = viewBasis(yaw, pitch);
  const [py, pp] = equirectToAngles(u, v);
  const yawRad = (py * Math.PI) / 180;
  const pitchRad = (pp * Math.PI) / 180;
  const dx = Math.sin(yawRad) * Math.cos(pitchRad);
  const dy = Math.sin(pitchRad);
  const dz = -Math.cos(yawRad) * Math.cos(pitchRad);
  const forward = dx * fx + dy * fy + dz * fz;
  if (forward < 0.02) return null;
  const across = Math.abs(dx * rx + dz * rz) / forward;
  const up = Math.abs(dx * ux + dy * uy + dz * uz) / forward;
  return (2 * Math.atan(Math.max(across, up / aspect)) * 180) / Math.PI;
}

/**
 * src: { data: Uint8ClampedArray (RGBA), width, height } — the equirect image.
 * view: { yaw, pitch (degrees), fov (horizontal, degrees), width, height } — the output.
 * Returns an RGBA Uint8ClampedArray of view.width × view.height, bilinearly sampled.
 */
export function projectRectilinear(src, { yaw, pitch = 0, fov = 80, width, height }) {
  const out = new Uint8ClampedArray(width * height * 4);
  const { fx, fy, fz, rx, rz, ux, uy, uz } = viewBasis(yaw, pitch);

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
