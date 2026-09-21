// Whether the visitor view uses the Compact layout: the stacked, touch-first
// layout (bottom sheets, radial dock, on-screen keyboard) shared by phones and
// portrait kiosk screens. There is no separate kiosk build — a wall-mounted
// kiosk is "vertically tall like a mobile phone" but can be much WIDER than
// one, so width alone would miss it; any portrait screen with real
// height-over-width gets the same treatment a phone does.
//
// Deliberately generous, and a ratio rather than an exact 1080×1920 match:
// innerWidth/innerHeight are CSS pixels, so Windows display scaling (125% →
// 864×1536) and browser chrome/taskbar (windowed, not F11/--kiosk) both change
// the reported size. The first kiosk's ratio is ~1.78; 1.3 leaves a wide
// margin below that, while a merely slightly-portrait desktop window stays on
// the desktop layout (portrait tablets, ~1.33, still get the shared touch layout).
export const COMPACT_MAX_WIDTH = 768;
export const PORTRAIT_ASPECT_THRESHOLD = 1.3;

export function isCompactLayout(width, height, maxWidth = COMPACT_MAX_WIDTH) {
  return width <= maxWidth || height > width * PORTRAIT_ASPECT_THRESHOLD;
}
