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

// Key order is display order: SidebarIntroOverlay lists them in this order
// and DESKTOP_INTRO_SPEECH reads them aloud in it.
export const SIDEBAR_INTRO_TEXT = {
  directory: "Browse the directory below to jump to highlighted locations.",
  search: "Search for a room or facility by name.",
  directions: "Get directions to any room.",
  building: "Hop straight to a specific building floor.",
  exit: "Nearest Exit shows the fastest way outside from wherever you are.",
  help: "Click the i button on the upper right corner to replay these tips.",
};

export const KIOSK_INTRO_TEXT = {
  drag: "Touch and drag to look around.",
  hotspot: "Tap a glowing arrow to walk that way.",
  menu: "Tap the menu button for search, directions and more.",
};

// Mobile web layout: the touch controls, then where everything else went
// (the sidebar slides in from the left, and the help button moved into it).
export const MOBILE_INTRO_TEXT = {
  drag: "Touch and drag to look around.",
  hotspot: "Tap a glowing arrow to walk that way.",
  zoom: "Pinch with two fingers to zoom in and out.",
  preview: "Hold the view still for a moment to preview where each arrow and room leads. Tap a preview to go there.",
  menu: "Tap the menu button on the left for the directory, search, directions, buildings, Nearest Exit and feedback.",
  help: "Tap the i button at the top right of the menu to see these tips again.",
};

export const DESKTOP_INTRO_SPEECH = [...Object.values(DESKTOP_INTRO_TEXT), ...Object.values(SIDEBAR_INTRO_TEXT)].join(" ");
export const KIOSK_INTRO_SPEECH = Object.values(KIOSK_INTRO_TEXT).join(" ");
export const MOBILE_INTRO_SPEECH = Object.values(MOBILE_INTRO_TEXT).join(" ");
