import { useCallback, useState } from "react";
import { clampZoom } from "../../utils/panoramaMath";

// Kiosk zoom level (1 = the screen's own default view). Changed by the
// on-screen + / - / reset buttons (kiosk, `zoomable`) — there is
// deliberately no two-finger pinch there: the kiosk's touch hardware
// reports two-finger gestures unreliably. Desktop instead uses the scroll
// wheel (`wheelZoomable`), via zoomByWheel below.
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

export function useZoom() {
  const [zoom, setZoomState] = useState(1);
  const setZoom = (z) => setZoomState(clampZoom(z));
  // Scrolling up (negative deltaY) zooms in, matching map-app convention.
  const zoomByWheel = useCallback((deltaY) => {
    setZoomState((z) => {
      const next = clampZoom(z * Math.exp(-deltaY * WHEEL_ZOOM_SENSITIVITY));
      return Math.abs(next - 1) < WHEEL_ZOOM_SNAP ? 1 : next;
    });
  }, []);
  return { zoom, setZoom, zoomByWheel };
}
