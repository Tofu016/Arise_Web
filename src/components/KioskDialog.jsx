import OnScreenKeyboard from "./OnScreenKeyboard";
import IconPlaceholder from "./IconPlaceholder";
import { KIOSK_TOP_INSET, KIOSK_BOTTOM_INSET, KIOSK_PANORAMA_FRACTION, KIOSK_DIALOG_TOP } from "../utils/kioskLayout";

// The kiosk view's dialog: one shared shell for every module that needs a
// keyboard (search, directions/nearest exit, feedback). It fills a
// half-band-tall slice of the panorama area, starting at KIOSK_DIALOG_TOP
// (kioskLayout.js) so the keyboard lands in comfortable reach, as a 2×2 grid:
//
//   ┌──────────────┬──────────────┐
//   │              │  (empty —    │
//   │   content    │   reserved)  │
//   │  (children,  ├──────────────┤
//   │  both left   │   keyboard   │
//   │  quadrants)  │              │
//   └──────────────┴──────────────┘
//                      (  ✕  )
//
// The close button is deliberately outside the grid, right-aligned below it.
// The keyboard lives here, not in each module, so it always sits in the
// bottom-right quadrant; it types into whichever field of `children` is
// focused (see OnScreenKeyboard). Fields inside should set inputMode="none".
// keyboard: which key set the on-screen keyboard shows — "search" (default) or
// "text" (see OnScreenKeyboard).
export default function KioskDialog({ title, titleClassName = "", keyboard = "search", onClose, children }) {
  return (
    <>
      {/* Dims and blocks the panorama area behind the dialog; a tap on it
          closes, like the backdrop of the centered modals. */}
      <div
        className="kiosk-dialog-scrim"
        style={{ top: `${KIOSK_TOP_INSET * 100}%`, bottom: `${KIOSK_BOTTOM_INSET * 100}%` }}
        onClick={onClose}
      />
      <div
        className="kiosk-dialog-layer"
        style={{
          top: `${KIOSK_DIALOG_TOP * 100}%`,
          "--kiosk-grid-height": `calc(${(KIOSK_PANORAMA_FRACTION / 2) * 100}vh - var(--kiosk-dialog-gap))`,
        }}
      >
        <div className="kiosk-dialog" role="dialog" aria-label={title}>
          <section className="kiosk-dialog-content">
            {title && <h3 className={`kiosk-dialog-title ${titleClassName}`}>{title}</h3>}
            {children}
          </section>
          {/* Top-right quadrant: intentionally empty for now. */}
          <aside className="kiosk-dialog-aside" />
          <div className="kiosk-dialog-keyboard">
            <OnScreenKeyboard layout={keyboard} />
          </div>
        </div>
        <button type="button" className="kiosk-dialog-close" onClick={onClose} aria-label="Close">
          <IconPlaceholder name="close" className="inline-icon-img" />
        </button>
      </div>
    </>
  );
}
