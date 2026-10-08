import buttonImg from "../assets/kiosk-start/button.png";
import letterA from "../assets/kiosk-start/letter-a.png";
import letterR from "../assets/kiosk-start/letter-r.png";
import letterI from "../assets/kiosk-start/letter-i.png";
import letterS from "../assets/kiosk-start/letter-s.png";
import letterE from "../assets/kiosk-start/letter-e.png";

// The animated ARISE logo's artwork and timeline, shared by the kiosk's
// tap-to-start screen (KioskStartScreen) and the desktop's auto-playing
// startup screen (DesktopStartScreen). Ported from the mobile app's
// React Native version; the keyframes live in index.css (.kiosk-logo-*),
// in the designer's SVG units, and must stay in step with the timings here.

// [left, top, width, height] of each letter, in SVG units (expanded logo
// 1470.5 x 601.4).
export const ARISE_LETTERS = [
  { src: letterA, box: [591.2, 225.0, 154, 164.6] },
  { src: letterR, box: [764.7, 225.6, 125, 164] },
  { src: letterI, box: [913.7, 225.6, 36, 164] },
  { src: letterS, box: [973.7, 223.1, 126.9, 168.8] },
  { src: letterE, box: [1124.7, 225.6, 112, 164] },
];
export const ARISE_BUTTON = buttonImg;

// The logo's timeline, the mobile one (2340ms) sped up 32%.
export const TYPE_START_MS = 1285;
export const LETTER_MS = 97;
export const LOGO_DURATION_MS = 1770;
