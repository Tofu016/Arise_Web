// Which of the visitor view's three layouts a screen gets:
//   "desktop"  the sidebar beside a framed panorama (an ordinary landscape screen)
//   "mobile"   the Mobile web layout: the same app, full-bleed panorama with the
//              sidebar as a slide-over drawer (phones, tablets held upright, an
//              unpaired kiosk)
//   "kiosk"    the Compact layout (radial dock, on-screen keyboard, Kiosk
//              session), only on a Paired kiosk
// Pairing is what turns a compact screen into a kiosk: the kiosk hardware
// first comes up in the Mobile web layout, where the hidden pairing gesture
// lives, and reloads into the Compact layout once paired.
//
// A compact screen is narrow, or portrait, or short. A wall-mounted kiosk is
// "vertically tall like a mobile phone" but can be much WIDER than one, so
// width alone would miss it; any portrait screen with real height-over-width
// counts. The ratio is deliberately generous rather than an exact 1080x1920
// match: innerWidth/innerHeight are CSS pixels, so Windows display scaling
// (125% gives 864x1536) and browser chrome/taskbar (windowed, not
// F11/--kiosk) both change the reported size. The first kiosk's ratio is
// ~1.78; 1.3 leaves a wide margin below that, while a merely slightly-portrait
// desktop window stays on the desktop layout (portrait tablets, ~1.33, still
// count). A phone turned sideways is wider than COMPACT_MAX_WIDTH (932x430 on
// a large iPhone) but far too short for the desktop's header and boxed
// sidebar, hence the height limit.
export const COMPACT_MAX_WIDTH = 768;
export const PORTRAIT_ASPECT_THRESHOLD = 1.3;
export const SHORT_SCREEN_MAX_HEIGHT = 500;

export function isCompactScreen(width, height, maxWidth = COMPACT_MAX_WIDTH) {
  return width <= maxWidth || height > width * PORTRAIT_ASPECT_THRESHOLD || height <= SHORT_SCREEN_MAX_HEIGHT;
}

export function pickViewLayout({ compactScreen, paired }) {
  if (!compactScreen) return "desktop";
  return paired ? "kiosk" : "mobile";
}
