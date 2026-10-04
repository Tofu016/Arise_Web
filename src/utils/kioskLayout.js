// Kiosk layout only: the panorama is inset to leave whitespace above and
// below it, since the screen's very bottom sits at shin height and is hard
// to look at. Fractions of the screen height. The top band holds the header,
// the bottom band the signage (advertisements). The kiosk dialog
// (KioskDialog.jsx) is laid out inside the band that's left over.
export const KIOSK_TOP_INSET = 0.075;
export const KIOSK_BOTTOM_INSET = 0.175;
export const KIOSK_PANORAMA_FRACTION = 1 - KIOSK_TOP_INSET - KIOSK_BOTTOM_INSET;

// The first kiosk's screen (see CONTEXT.md, "Compact layout"). Signage (the
// media rotating in the bottom band, see utils/signage.js) is cropped for
// this screen's band: 1080 x 336, a wide 45:14 strip. Other Compact-layout
// screens get a band of a slightly different shape, and the cropped area
// is scaled to cover it (see cropLayout).
export const KIOSK_REFERENCE_WIDTH = 1080;
export const KIOSK_REFERENCE_HEIGHT = 1920;
export const SIGNAGE_REFERENCE_SIZE = {
  width: KIOSK_REFERENCE_WIDTH,
  height: Math.round(KIOSK_REFERENCE_HEIGHT * KIOSK_BOTTOM_INSET),
};
export const SIGNAGE_ASPECT = SIGNAGE_REFERENCE_SIZE.width / SIGNAGE_REFERENCE_SIZE.height;

// Where the kiosk dialog grid (KioskDialog / KioskRoomCard, and the walk bar
// that replaces its keyboard) starts, as a fraction of screen height. The
// grid is half the panorama band tall, so it ends at
// KIOSK_DIALOG_TOP + KIOSK_PANORAMA_FRACTION / 2. Pushed below the top of the
// band on purpose: the keyboard is the one control people type on for a
// while, so it is kept inside the 0.95 to 1.22 m reach range (1.22 m being
// the highest comfortable forward reach from a wheelchair) instead of
// riding at the top of a 65" portrait screen whose bottom edge is ~0.28 m
// off the floor. Tune this, not the components, if the mounting changes.
export const KIOSK_DIALOG_TOP = 0.255;

// Vertical center (fraction of screen height) of the panorama band itself —
// the middle of what's actually visible between the header and bottom
// whitespace, not the middle of the whole screen. Used to anchor the
// middle-right FAB so it centers on the panorama rather than the viewport.
export const KIOSK_PANORAMA_CENTER = KIOSK_TOP_INSET + KIOSK_PANORAMA_FRACTION * 0.5;

// Vertical center (fraction of screen height) of the kiosk's small dialogs —
// the middle of the dialog grid, i.e. where its two rows of quadrants meet
// (a quarter of the way down the panorama band). Shared by the thank-you card,
// the idle prompt and the account and building dialogs.
export const KIOSK_CARD_CENTER = KIOSK_TOP_INSET + KIOSK_PANORAMA_FRACTION * 0.25;

// Vertical center (fraction of screen height) of the kiosk dialog grid itself
// (the search dialog's footprint), for small prompts that belong to the
// search flow: the "starting from" and stairs/elevator choices.
export const KIOSK_DIALOG_CENTER = KIOSK_DIALOG_TOP + KIOSK_PANORAMA_FRACTION * 0.25;

// Inline style for a .kiosk-raised-overlay (see index.css) that sets that
// center as a CSS variable.
export const KIOSK_RAISED_STYLE = { "--kiosk-card-center": `${KIOSK_CARD_CENTER * 100}vh` };

// Same, centered on the search dialog's footprint instead.
export const KIOSK_DIALOG_CENTER_STYLE = { "--kiosk-card-center": `${KIOSK_DIALOG_CENTER * 100}vh` };
