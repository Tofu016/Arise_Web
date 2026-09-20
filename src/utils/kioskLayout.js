// Kiosk layout only: the panorama is inset to leave whitespace above and
// below it, since the screen's very bottom sits at shin height and is hard
// to look at. Fractions of the screen height. The top band is reserved for
// a future header, the bottom band for a future graphic. The kiosk dialog
// (KioskDialog.jsx) is laid out inside the band that's left over.
export const KIOSK_TOP_INSET = 0.15;
export const KIOSK_BOTTOM_INSET = 0.25;
export const KIOSK_PANORAMA_FRACTION = 1 - KIOSK_TOP_INSET - KIOSK_BOTTOM_INSET;
