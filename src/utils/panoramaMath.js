// The geometry behind the panorama viewer, with no three.js or React in
// it. Yaw/pitch are degrees: yaw 0 points along -Z and increases
// clockwise seen from above; pitch is up/down from the horizon.

export const MARKER_RADIUS = 480; // just inside the 500-radius panorama sphere, so arrows sit in front of the image

// Where a hotspot/marker at (yaw, pitch) sits in the scene.
export function toPosition(yaw, pitch, radius = MARKER_RADIUS) {
  const yawRad = (yaw * Math.PI) / 180;
  const pitchRad = (pitch * Math.PI) / 180;
  return [
    radius * Math.sin(yawRad) * Math.cos(pitchRad),
    radius * Math.sin(pitchRad),
    -radius * Math.cos(yawRad) * Math.cos(pitchRad),
  ];
}

// Converts a raycast hit point on the sphere back into yaw/pitch, used when
// the user clicks the panorama itself to place or reposition a hotspot.
export function toAngles(point) {
  const r = Math.sqrt(point.x * point.x + point.y * point.y + point.z * point.z);
  const pitch = (Math.asin(point.y / r) * 180) / Math.PI;
  const yaw = ((Math.atan2(point.x, -point.z) * 180) / Math.PI + 360) % 360;
  return { yaw, pitch };
}

// The camera "looks toward" whatever's opposite its position (since
// OrbitControls points it at the target near the origin) — so to make the
// initial view face a given yaw/pitch, the starting camera position has to
// sit on the OPPOSITE side.
export function initialCameraPosition(yaw, pitch, radius = 0.1) {
  const [x, y, z] = toPosition(yaw, pitch, radius);
  return [-x, -y, -z];
}

// Rather than a two-value landscape/portrait switch, this targets a
// constant HORIZONTAL field of view and derives the vertical FOV Three.js
// wants from the real aspect ratio — so a kiosk's actual screen (anywhere
// between a narrow phone-like panel and a much wider portrait touchscreen)
// gets a horizontal view that reads the same regardless of exact shape.
//
// Clamped at both ends: MIN_FOV keeps a very wide/short screen from
// zooming in uncomfortably tight, MAX_FOV keeps a very tall/narrow one well
// short of fisheye territory. Reasonable starting points, not precisely
// derived — worth tuning by eye at the deployed kiosk's real aspect ratio.
export const TARGET_HORIZONTAL_FOV = 100; // degrees
export const MIN_FOV = 60;
export const MAX_FOV = 180;

export function computeFov(width, height) {
  if (!width || !height) return TARGET_HORIZONTAL_FOV;
  const aspect = width / height;
  const targetHorizontalRad = (TARGET_HORIZONTAL_FOV * Math.PI) / 180;
  const verticalRad = 2 * Math.atan(Math.tan(targetHorizontalRad / 2) / aspect);
  const verticalDeg = (verticalRad * 180) / Math.PI;
  return Math.min(MAX_FOV, Math.max(MIN_FOV, verticalDeg));
}
