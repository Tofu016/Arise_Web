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

// Hotspots and markers are sized in scene units, so on screen they're
// proportional to canvasHeight / tan(fov/2): a tall kiosk (wide vertical FOV)
// shrinks them to about half of what a landscape desktop shows. This factor
// undoes that, so they keep the same apparent size relative to the screen's
// shorter side. Normalised so a 1920x1080 desktop is exactly 1 — the size
// they were tuned at — and any screen with the same shape scales in step.
const OVERLAY_REF_HEIGHT = 1080;
const OVERLAY_REF_PX_PER_UNIT =
  OVERLAY_REF_HEIGHT / 2 / Math.tan(((computeFov(1920, 1080) * Math.PI) / 180) / 2);

export function overlayScale(width, height, fov) {
  if (!width || !height || !fov) return 1;
  const pxPerUnit = height / 2 / Math.tan(((fov * Math.PI) / 180) / 2);
  return (Math.min(width, height) / OVERLAY_REF_HEIGHT) * (OVERLAY_REF_PX_PER_UNIT / pxPerUnit);
}

// Kiosk pinch zoom: `zoom` multiplies the apparent magnification (1 = the
// screen's own default view, >1 zoomed in, <1 zoomed out). Applied to the
// vertical FOV through its tangent, which is what magnification actually
// scales, and clamped so zooming out stops short of fisheye.
export const MIN_ZOOM = 0.7;
export const MAX_ZOOM = 3;
const ZOOMED_MIN_FOV = 20;
const ZOOMED_MAX_FOV = 165;

export function clampZoom(zoom) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function zoomedFov(baseFov, zoom) {
  const halfRad = (baseFov * Math.PI) / 360;
  const fov = (2 * Math.atan(Math.tan(halfRad) / clampZoom(zoom)) * 180) / Math.PI;
  return Math.min(ZOOMED_MAX_FOV, Math.max(ZOOMED_MIN_FOV, fov));
}

export function computeFov(width, height) {
  if (!width || !height) return TARGET_HORIZONTAL_FOV;
  const aspect = width / height;
  const targetHorizontalRad = (TARGET_HORIZONTAL_FOV * Math.PI) / 180;
  const verticalRad = 2 * Math.atan(Math.tan(targetHorizontalRad / 2) / aspect);
  const verticalDeg = (verticalRad * 180) / Math.PI;
  return Math.min(MAX_FOV, Math.max(MIN_FOV, verticalDeg));
}

// A hotspot counts as "facing" the visitor (its preview may be mounted) while
// the cosine of the angle between the view direction and the hotspot is above
// this: cos(~78°), generous, so a card near the screen edge still shows.
export const FACING_DOT = 0.2;

export function isFacing(lookDot) {
  return lookDot > FACING_DOT;
}

// The sneak-peek preview card scales with how directly the visitor looks at
// its hotspot: PREVIEW_MAX_SCALE when looking straight at it, shrinking
// linearly to PREVIEW_MIN_SCALE once the hotspot is PREVIEW_FALLOFF_DEG away
// from the view direction (about where it leaves the screen). Raise
// PREVIEW_MAX_SCALE for a bigger card up close; lower PREVIEW_MIN_SCALE to make
// far-off cards shrink more.
export const PREVIEW_MAX_SCALE = 1.0;
export const PREVIEW_MIN_SCALE = 0.38;
export const PREVIEW_FALLOFF_DEG = 75;

// `lookDot` is the cosine of that angle (view direction · hotspot direction).
export function previewScale(lookDot) {
  const angleDeg = (Math.acos(Math.min(1, Math.max(-1, lookDot))) * 180) / Math.PI;
  const t = Math.min(1, angleDeg / PREVIEW_FALLOFF_DEG);
  return PREVIEW_MAX_SCALE + (PREVIEW_MIN_SCALE - PREVIEW_MAX_SCALE) * t;
}

// Directions auto-pan: how far (radians) to turn this frame toward a target
// `angleRad` away. Eases out (speed follows the remaining angle) between a
// floor and a ceiling in degrees per second so it stays gentle; a long frame
// is capped at 0.1s so a hitch can't jump the view. 0 once close enough.
export const AUTO_PAN_MIN_DEG_PER_SEC = 6;
export const AUTO_PAN_MAX_DEG_PER_SEC = 30;
export const AUTO_PAN_EASE = 0.5; // share of the remaining angle covered per second
export const AUTO_PAN_DONE_DEG = 0.5;

export function autoPanStep(angleRad, deltaSeconds) {
  const angleDeg = (angleRad * 180) / Math.PI;
  if (angleDeg < AUTO_PAN_DONE_DEG) return 0;
  const speed = Math.min(AUTO_PAN_MAX_DEG_PER_SEC, Math.max(AUTO_PAN_MIN_DEG_PER_SEC, angleDeg * AUTO_PAN_EASE));
  return Math.min(angleRad, ((speed * Math.PI) / 180) * Math.min(deltaSeconds, 0.1));
}

// Desktop WASD/arrow-key controls: how fast A/D (or Left/Right) pan the
// view, in degrees per second.
export const KEYBOARD_PAN_DEG_PER_SEC = 90;

// The angle (radians) between two yaw/pitch directions, via the dot
// product of their unit vectors.
export function angleBetween(yaw1, pitch1, yaw2, pitch2) {
  const [x1, y1, z1] = toPosition(yaw1, pitch1, 1);
  const [x2, y2, z2] = toPosition(yaw2, pitch2, 1);
  const dot = x1 * x2 + y1 * y2 + z1 * z2;
  return Math.acos(Math.min(1, Math.max(-1, dot)));
}

function normalize3([x, y, z]) {
  const len = Math.hypot(x, y, z);
  return len > 1e-9 ? [x / len, y / len, z / len] : [0, 0, 0];
}

function cross3([ax, ay, az], [bx, by, bz]) {
  return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
}

function dot3([ax, ay, az], [bx, by, bz]) {
  return ax * bx + ay * by + az * bz;
}

// Whether (yaw, pitch) falls inside the rectangular viewport a camera
// looking along (viewYaw, viewPitch) actually shows, given its horizontal
// and vertical half-field-of-view (degrees) — not just "within some
// radius of dead ahead", which would count things off to the side of a
// narrow FOV as visible. Builds the camera's local right/up/forward axes
// and checks the target's angle off-axis in each plane separately, the
// same test a perspective projection does.
export function isInViewport(viewYaw, viewPitch, yaw, pitch, halfHorizontalDeg, halfVerticalDeg) {
  const forward = normalize3(toPosition(viewYaw, viewPitch, 1));
  const worldUp = [0, 1, 0];
  let right = cross3(forward, worldUp);
  if (right[0] * right[0] + right[1] * right[1] + right[2] * right[2] < 1e-9) right = [1, 0, 0]; // looking straight up/down
  right = normalize3(right);
  const up = normalize3(cross3(right, forward));

  const target = toPosition(yaw, pitch, 1);
  const x = dot3(target, right);
  const y = dot3(target, up);
  const z = dot3(target, forward);
  if (z <= 0) return false; // behind the camera entirely

  const horizontalDeg = Math.abs((Math.atan2(x, z) * 180) / Math.PI);
  const verticalDeg = Math.abs((Math.atan2(y, z) * 180) / Math.PI);
  return horizontalDeg <= halfHorizontalDeg && verticalDeg <= halfVerticalDeg;
}

// W/ArrowUp: which hotspot is closest to dead ahead (viewYaw/viewPitch, the
// camera's current look direction) among those actually visible on screen
// right now (within the given half-FOVs) — a hotspot just out of frame
// doesn't count, even if it's only a few degrees past the edge. Returns
// null when nothing on screen qualifies, so pressing the key does nothing
// and a "nothing there" hint can be shown instead of walking somewhere the
// visitor can't currently see.
export function closestHotspotInView(hotspots, viewYaw, viewPitch, halfHorizontalDeg, halfVerticalDeg) {
  let best = null;
  let bestAngle = Infinity;
  for (const h of hotspots) {
    if (!isInViewport(viewYaw, viewPitch, h.yaw, h.pitch, halfHorizontalDeg, halfVerticalDeg)) continue;
    const angle = angleBetween(viewYaw, viewPitch, h.yaw, h.pitch);
    if (angle < bestAngle) {
      bestAngle = angle;
      best = h;
    }
  }
  return best;
}
