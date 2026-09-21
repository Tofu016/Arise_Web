// Kiosk layout only: the panorama is inset to leave whitespace above and
// below it, since the screen's very bottom sits at shin height and is hard
// to look at. Fractions of the screen height. The top band is reserved for
// a future header, the bottom band for a future graphic. The kiosk dialog
// (KioskDialog.jsx) is laid out inside the band that's left over.
export const KIOSK_TOP_INSET = 0.075;
export const KIOSK_BOTTOM_INSET = 0.175;
export const KIOSK_PANORAMA_FRACTION = 1 - KIOSK_TOP_INSET - KIOSK_BOTTOM_INSET;

// Vertical center (fraction of screen height) of the kiosk's small dialogs —
// the middle of the dialog grid, i.e. where its two rows of quadrants meet
// (a quarter of the way down the panorama band). Shared by the thank-you card,
// the idle prompt and the account and building dialogs.
export const KIOSK_CARD_CENTER = KIOSK_TOP_INSET + KIOSK_PANORAMA_FRACTION * 0.25;

// Inline style for a .kiosk-raised-overlay (see index.css) that sets that
// center as a CSS variable.
export const KIOSK_RAISED_STYLE = { "--kiosk-card-center": `${KIOSK_CARD_CENTER * 100}vh` };
