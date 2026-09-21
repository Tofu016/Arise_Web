import { useState } from "react";
import { clampZoom } from "../../utils/panoramaMath";

// Kiosk zoom level (1 = the screen's own default view). Changed only by the
// on-screen + / - / reset buttons — there is deliberately no two-finger pinch
// or wheel zoom: the kiosk's touch hardware reports two-finger gestures
// unreliably.
export const BUTTON_ZOOM_FACTOR = 1.25; // one tap of + or -

export function useZoom() {
  const [zoom, setZoomState] = useState(1);
  const setZoom = (z) => setZoomState(clampZoom(z));
  return { zoom, setZoom };
}
