import { KIOSK_DIALOG_CENTER_STYLE } from "../utils/kioskLayout";

// Kiosk only: shown after "Directions" is tapped on a search result or room
// card, asking where the route should start. Centered horizontally, and
// vertically on the search dialog's footprint. Tapping the scrim cancels.
//   Current Location   the node on screen right now
//   Kiosk Location     where this kiosk physically stands; only offered once the
//                      kiosk is paired and an admin has given it a location
//   Custom Location    opens the directions panel with the starting point blank
export default function KioskOriginChoice({ destinationName, kioskAvailable, onCurrent, onKiosk, onCustom, onCancel }) {
  return (
    <div className="modal-overlay kiosk-raised-overlay" style={KIOSK_DIALOG_CENTER_STYLE} onClick={onCancel}>
      <div
        className="modal origin-choice-modal"
        role="dialog"
        aria-label="Choose a starting point"
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Directions to {destinationName}</h3>
        <p className="origin-choice-sub">Where are you starting from?</p>
        <div className="origin-choice-list">
          <button type="button" className="origin-choice-option" onClick={onCurrent}>
            Current Location On Screen
          </button>
          {kioskAvailable && (
            <button type="button" className="origin-choice-option" onClick={onKiosk}>
              Kiosk Location
            </button>
          )}
          <button type="button" className="origin-choice-option" onClick={onCustom}>
            Custom Location
          </button>
        </div>
        <div className="form-actions">
          <button type="button" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
