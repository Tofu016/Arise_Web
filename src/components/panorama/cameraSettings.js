import { useEffect, useState } from "react";
import { computeFov, TARGET_HORIZONTAL_FOV } from "../../utils/panoramaMath";

// How fast dragging turns the view: bigger = the view moves further for the
// same finger (or mouse) movement, smaller = slower and finer. The sign only
// sets the drag direction, so keep the numbers positive and change these two.
//   TOUCH_ROTATE_SPEED   the kiosk and any touch screen — tune this for the kiosk
//   MOUSE_ROTATE_SPEED   mouse dragging on desktop and the admin previews
export const TOUCH_ROTATE_SPEED = 0.8;
export const MOUSE_ROTATE_SPEED = 0.4;

// Three.js's fov is vertical, not horizontal, and @react-three/fiber
// already keeps aspect ratio correctly synced to the real viewport
// shape — so a FIXED vertical FOV mathematically produces a narrower
// HORIZONTAL view on a narrower screen, not a display bug, just the
// geometry of a fixed vertical angle applied to a narrower width.
// The field of view follows the window: see computeFov in utils/panoramaMath.js.
// heightFraction is how much of the window's height the canvas actually
// occupies (1 = all of it), so a canvas inset by whitespace still gets the
// FOV for its own, shorter shape.
export function usePanoramaFov(heightFraction) {
  const [fov, setFov] = useState(() =>
    typeof window !== "undefined"
      ? computeFov(window.innerWidth, window.innerHeight * heightFraction)
      : TARGET_HORIZONTAL_FOV
  );
  useEffect(() => {
    const updateFov = () => setFov(computeFov(window.innerWidth, window.innerHeight * heightFraction));
    window.addEventListener("resize", updateFov);
    // orientationchange fires on real device rotation more reliably than
    // resize alone on some touchscreen/tablet setups.
    window.addEventListener("orientationchange", updateFov);
    return () => {
      window.removeEventListener("resize", updateFov);
      window.removeEventListener("orientationchange", updateFov);
    };
  }, [heightFraction]);
  return fov;
}
