import IconPlaceholder from "./IconPlaceholder";
import { KIOSK_DIALOG_CENTER_STYLE } from "../utils/kioskLayout";

// Kiosk only: the stairs-or-elevator question for a route that changes floors
// and could do either (see pendingModeChoice in utils/directionsRoute.js).
// Shown on its own instead of the big directions dialog, so the visitor
// answers one question without the keyboard in the way. Tapping the scrim
// cancels, like Cancel.
export default function KioskModeChoice({ stairsStops, elevatorStops, onStairs, onElevator, onCancel }) {
  return (
    <div className="modal-overlay kiosk-raised-overlay" style={KIOSK_DIALOG_CENTER_STYLE} onClick={onCancel}>
      <div
        className="modal origin-choice-modal"
        role="dialog"
        aria-label="Choose stairs or elevator"
        onClick={(e) => e.stopPropagation()}
      >
        <h3>This route changes floors</h3>
        <p className="origin-choice-sub">How do you want to get there?</p>
        <div className="origin-choice-list">
          <button type="button" className="origin-choice-option" onClick={onStairs}>
            <IconPlaceholder name="stairs" variant="white" className="inline-icon-img" /> Take the stairs
            <span className="directions-mode-sub">{stairsStops} stops</span>
          </button>
          <button type="button" className="origin-choice-option" onClick={onElevator}>
            <IconPlaceholder name="elevator" variant="white" className="inline-icon-img" /> Take the elevator
            <span className="directions-mode-sub">{elevatorStops} stops · step-free</span>
          </button>
        </div>
        <div className="form-actions">
          <button type="button" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
