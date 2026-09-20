import { KIOSK_TOP_INSET, KIOSK_PANORAMA_FRACTION } from "../utils/kioskLayout";

// Kiosk view only: the compact controls that replace the big directions
// dialog while a route is being walked, so the panorama stays visible. It
// sits where the dialog's on-screen keyboard was (right-hand column, bottom
// aligned with the keyboard quadrant), which is where a visitor's hand
// already is, and holds just the three things needed mid-route:
//
//   - Walk to the next stop
//   - an Auto-walk switch
//   - a button that brings the full directions dialog back
//
// Anchored with the same viewport-fraction constants the dialog uses
// (kioskLayout.js), so it follows the dialog's geometry if those change.
export default function KioskWalkBar({
  progressText,
  nextStopName,
  autoWalking,
  onWalk,
  onToggleAutoWalk,
  onShowDialog,
}) {
  // The dialog's grid ends at half the panorama area's height; its keyboard
  // is the lower-right cell, inset by the grid's own 12px padding.
  const bottom = `calc(${(1 - KIOSK_TOP_INSET - KIOSK_PANORAMA_FRACTION / 2) * 100}vh + 12px)`;

  return (
    <div className="kiosk-walkbar" style={{ bottom }} role="region" aria-label="Walking controls">
      <p className="kiosk-walkbar-progress">{progressText}</p>

      <button type="button" className="primary kiosk-walkbar-walk" onClick={onWalk} disabled={autoWalking}>
        Walk to {nextStopName} →
      </button>

      <div className="kiosk-walkbar-row">
        <button
          type="button"
          role="switch"
          aria-checked={autoWalking}
          className={"kiosk-walkbar-switch" + (autoWalking ? " kiosk-walkbar-switch-on" : "")}
          onClick={onToggleAutoWalk}
        >
          <span className="kiosk-walkbar-switch-track" aria-hidden="true">
            <span className="kiosk-walkbar-switch-thumb" />
          </span>
          <span>Auto-walk</span>
        </button>

        <button type="button" className="kiosk-walkbar-dialog-btn" onClick={onShowDialog}>
          📋 Directions
        </button>
      </div>
    </div>
  );
}
