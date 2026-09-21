import OnScreenKeyboard from "./OnScreenKeyboard";
import { KIOSK_TOP_INSET, KIOSK_BOTTOM_INSET, KIOSK_PANORAMA_FRACTION } from "../utils/kioskLayout";

// The kiosk view's dialog: one shared shell for every module that needs a
// keyboard (search, directions/nearest exit, feedback). It fills the top
// half of the panorama area — from just under the header down to the
// panorama's vertical middle — as a 2×2 grid:
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
export default function KioskDialog({ title, titleClassName = "", onClose, children }) {
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
          top: `${KIOSK_TOP_INSET * 100}%`,
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
            <OnScreenKeyboard />
          </div>
        </div>
        <button type="button" className="kiosk-dialog-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
    </>
  );
}
