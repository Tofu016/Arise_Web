import { useCallback, useState } from "react";
import { clampZoom } from "../../utils/panoramaMath";

// Panorama zoom level (1 = the screen's own default view). Changed by the
// on-screen + / - / reset buttons (kiosk, `zoomable`); there is
// deliberately no two-finger pinch there: the kiosk's touch hardware
// reports two-finger gestures unreliably. Desktop instead uses the scroll
// wheel (`wheelZoomable`), via zoomByWheel below, and the Mobile web layout
// a two-finger pinch (`pinchZoomable`), via pinchedZoom.
export const BUTTON_ZOOM_FACTOR = 1.25; // one tap of + or -

// Desktop scroll-wheel zoom: each wheel event scales the zoom exponentially
// by its deltaY, so a bigger scroll (trackpad) or a single notch (mouse
// wheel) both feel proportional instead of jumping by a fixed step.
const WHEEL_ZOOM_SENSITIVITY = 0.0012;

// Scrolling back within this margin of 1.0 snaps exactly to it. Without
// this, reversing a scroll lands on some 0.987 or 1.013 that never quite
// settles at the default view (and never clears the zoom indicator, which
// only hides at exactly 1.0) — the snap is what lets a visitor naturally
// scroll their way back to x1.0 instead of hunting for it pixel by pixel.
const WHEEL_ZOOM_SNAP = 0.02;

// Pinching within this margin of 1.0 holds exactly at it, a detent the
// fingers have to push through: a pinch that crosses back over the default
// view settles on x1.0 instead of some 0.97 or 1.04 the visitor would have
// to fiddle with to clear the indicator. Wider than the wheel's snap, since
// fingers are far less precise than wheel notches.
export const PINCH_ZOOM_SNAP = 0.08;

// The zoom a pinch gives: the zoom when the two fingers landed, scaled by how
// far apart they are now compared to then (`ratio`), clamped, with the 1.0
// detent above.
export function pinchedZoom(startZoom, ratio) {
  const next = clampZoom(startZoom * ratio);
  return Math.abs(next - 1) < PINCH_ZOOM_SNAP ? 1 : next;
}

// One + (direction 1) or - (direction -1) tap. A step that would cross 1.0
// lands on it instead: the multiplicative steps drift off 1.0 once a clamp at
// MIN_ZOOM/MAX_ZOOM has eaten part of a step (0.7 * 1.25 * 1.25 is 1.09, not
// 1), so without this a visitor could never zoom their way back to the
// default view with the buttons alone.
export function stepZoom(zoom, direction) {
  const next = clampZoom(direction > 0 ? zoom * BUTTON_ZOOM_FACTOR : zoom / BUTTON_ZOOM_FACTOR);
  return (zoom - 1) * (next - 1) < 0 ? 1 : next;
}

export function useZoom() {
  const [zoom, setZoomState] = useState(1);
  const setZoom = useCallback((z) => setZoomState(clampZoom(z)), []);
  // Scrolling up (negative deltaY) zooms in, matching map-app convention.
  const zoomByWheel = useCallback((deltaY) => {
    setZoomState((z) => {
      const next = clampZoom(z * Math.exp(-deltaY * WHEEL_ZOOM_SENSITIVITY));
      return Math.abs(next - 1) < WHEEL_ZOOM_SNAP ? 1 : next;
    });
  }, []);
  return { zoom, setZoom, zoomByWheel };
}
