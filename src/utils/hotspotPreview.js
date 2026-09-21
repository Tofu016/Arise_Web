// When a hotspot's sneak-peek preview shows, and what a tap on it does.
// Pure, so the hover/touch/kiosk rules are testable without a canvas.

// The preview is mounted only while the hotspot is in front of the camera
// (drei's <Html> re-places itself only when its projected position changes,
// so one first placed while the hotspot was behind the camera could sit stuck
// over the view ahead), and not once this hotspot was just used to leave the
// scene or while something covers the panorama. Then it shows always on the
// kiosk (`alwaysPreview`), otherwise on hover, or after a first tap on touch.
export function previewShown({ previewHidden, clicked, facing, alwaysPreview, hovered }) {
  if (previewHidden || clicked || !facing) return false;
  return alwaysPreview || hovered;
}

// "peek": a first touch tap reveals the preview instead of walking there.
// "go": walk there — a second touch tap, the only tap needed with a mouse, or
// on the kiosk, where the preview is permanently shown.
export function resolveHotspotClick({ isTouch, hovered, alwaysPreview }) {
  return isTouch && !hovered && !alwaysPreview ? "peek" : "go";
}
