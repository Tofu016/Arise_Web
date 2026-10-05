import AutoWalkCountdown from "./AutoWalkCountdown";
import { KIOSK_DIALOG_TOP, KIOSK_PANORAMA_FRACTION } from "../utils/kioskLayout";
import IconPlaceholder from "./IconPlaceholder";
import chevronRightWhite from "../assets/icons/chevron-right-white.svg";

// Kiosk view only: the compact controls that replace the big directions
// dialog while a route is being walked, so the panorama stays visible. It
// sits where the dialog's on-screen keyboard was (right-hand column, bottom
// aligned with the keyboard quadrant), which is where a visitor's hand
// already is, and holds just the three things needed mid-route:
//
//   - Walk to the next stop
//   - Skip hallway, when the route runs straight along one for 2+ stops
//   - an Auto-walk switch
//   - a button that brings the full directions dialog back
//
// Anchored with the same viewport-fraction constants the dialog uses
// (kioskLayout.js), so it follows the dialog's geometry if those change.
export default function KioskWalkBar({
  progressText,
  nextStopAction,
  isElevator,
  isFireStairs,
  autoWalking,
  stepIndex,
  onWalk,
  skipCount,
  onSkip,
  onToggleAutoWalk,
  onShowDialog,
  emergency,
  onBlocked,
  onEnd,
}) {
  // The dialog's grid is half the panorama area tall, starting at
  // KIOSK_DIALOG_TOP; its keyboard is the lower-right cell, inset by the
  // grid's own 12px padding.
  const bottom = `calc(${(1 - KIOSK_DIALOG_TOP - KIOSK_PANORAMA_FRACTION / 2) * 100}vh + 12px)`;

  return (
    <div className="kiosk-walkbar" style={{ bottom }} role="region" aria-label="Walking controls">
      <p className="kiosk-walkbar-progress">{progressText}</p>
      <p className="kiosk-walkbar-hint">
        {isElevator
          ? "The elevator is glowing in the photo. Tap it, or use the button below."
          : isFireStairs
            ? "The Emergency Exit sign is glowing in the photo. Tap it, or use the button below."
            : "Follow the yellow hotspot: it marks the correct path to your destination."}
      </p>
      {emergency && (
        <p className="kiosk-walkbar-hint kiosk-walkbar-emergency">
          <strong>Use the stairs, not elevators.</strong>
          {emergency.ascends && " This route goes up: no level or downward way was found. Call for help."}
          {" "}Emergency hotline: <strong>161</strong>
        </p>
      )}

      <button type="button" className="primary directions-go-btn kiosk-walkbar-walk" onClick={onWalk} disabled={autoWalking}>
        {isElevator && <IconPlaceholder name="elevator" className="inline-icon-img" />}
        {isFireStairs && <IconPlaceholder name="stairs" variant="white" className="inline-icon-img" />} {nextStopAction}{" "}
        <img src={chevronRightWhite} alt="" className="inline-icon-img" />
      </button>

      {skipCount > 0 && (
        <button type="button" className="kiosk-walkbar-dialog-btn kiosk-walkbar-skip" onClick={onSkip} disabled={autoWalking}>
          <IconPlaceholder name="skip-forward" /> Skip hallway ({skipCount} stops)
        </button>
      )}

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
          {autoWalking && <AutoWalkCountdown key={stepIndex} />}
        </button>

        {!emergency && (
          <button type="button" className="kiosk-walkbar-dialog-btn" onClick={onShowDialog}>
            <IconPlaceholder name="clipboard-list" /> Directions
          </button>
        )}
        {emergency && (
          <button type="button" className="kiosk-walkbar-dialog-btn" onClick={onBlocked}>
            This way is blocked
          </button>
        )}
        <button type="button" className="kiosk-walkbar-dialog-btn" onClick={onEnd}>
          <IconPlaceholder name="close" /> End route
        </button>
      </div>
    </div>
  );
}
