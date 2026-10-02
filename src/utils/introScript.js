// The intro overlays' instruction text, in one place so what's on screen and
// what's read aloud (when the visitor replays them from the help button)
// can't drift apart.
export const DESKTOP_INTRO_TEXT = {
  drag: "Click and drag to look around.",
  hotspot: "Click a glowing hotspot to move to that spot.",
  zoom: "Scroll the wheel to zoom in and out.",
  or: "Or",
  wasd: "A and D to look left and right, W to move forward, S to go back.",
  shiftCtrl: "Shift to zoom in, Control to zoom out.",
};

export const SIDEBAR_INTRO_TEXT = {
  exit: "Nearest Exit shows the fastest way outside from wherever you are.",
  search: "Search for a room, building, or place by name.",
  directions: "Get directions to any room.",
  directory: "Browse the directory below to jump to any building or room.",
  help: "Come back here anytime to replay these tips.",
};

export const KIOSK_INTRO_TEXT = {
  drag: "Touch and drag to look around.",
  hotspot: "Tap a glowing arrow to walk that way.",
  menu: "Tap the menu button for search, directions and more.",
};

export const DESKTOP_INTRO_SPEECH = [...Object.values(DESKTOP_INTRO_TEXT), ...Object.values(SIDEBAR_INTRO_TEXT)].join(" ");
export const KIOSK_INTRO_SPEECH = Object.values(KIOSK_INTRO_TEXT).join(" ");
