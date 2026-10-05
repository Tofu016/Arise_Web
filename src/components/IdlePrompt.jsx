import { useState } from "react";
import { useCountdown } from "../hooks/useCountdown";
import CountdownRing from "./CountdownRing";
import { KIOSK_RAISED_STYLE } from "../utils/kioskLayout";

export const IDLE_RESTART_SECONDS = 180;

// The "Done exploring?" prompt shown after a period of inactivity.
// Reuses .modal-overlay/.modal directly (same pattern as the app's
// other warning-style modals) for a genuinely locked, centered,
// scrim-backed prompt. A click on the dimmed panorama behind it counts as
// "Keep exploring" (the non-destructive choice), so a visitor who is still
// looking around can dismiss it without hunting for the button.
//
// onStartOver (kiosk only): adds a two-tap "Start over" button and a
// visible countdown after which the system restarts on its own.
export default function IdlePrompt({ onContinue, onGiveFeedback, onStartOver }) {
  if (onStartOver) {
    return <KioskIdlePrompt onContinue={onContinue} onGiveFeedback={onGiveFeedback} onStartOver={onStartOver} />;
  }
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onContinue()}>
      <div className="modal idle-prompt-modal">
        <p className="idle-prompt-text">Done exploring?</p>
        <div className="form-actions">
          <button type="button" onClick={onContinue}>Keep exploring</button>
          <button type="button" className="primary" onClick={onGiveFeedback}>Give feedback</button>
        </div>
      </div>
    </div>
  );
}

function KioskIdlePrompt({ onContinue, onGiveFeedback, onStartOver }) {
  const [confirming, setConfirming] = useState(false);
  const remaining = useCountdown(IDLE_RESTART_SECONDS, onStartOver);

  return (
    <div
      className="modal-overlay kiosk-raised-overlay"
      style={KIOSK_RAISED_STYLE}
      onClick={(e) => e.target === e.currentTarget && onContinue()}
    >
      <div className="modal idle-prompt-modal idle-prompt-kiosk">
        <p className="idle-prompt-text">
          {confirming ? "Start over? You'll lose your place." : "Done exploring?"}
        </p>
        <div className="form-actions">
          {confirming ? (
            <>
              <button type="button" onClick={() => setConfirming(false)}>Cancel</button>
              <button type="button" className="primary" onClick={onStartOver}>Yes, start over</button>
            </>
          ) : (
            <>
              <button type="button" onClick={onContinue}>Keep exploring</button>
              <button type="button" onClick={() => setConfirming(true)}>Start over</button>
              <button type="button" className="primary" onClick={onGiveFeedback}>Give feedback</button>
            </>
          )}
        </div>
        <div className="idle-prompt-countdown">
          <span>Starting over in</span>
          <CountdownRing total={IDLE_RESTART_SECONDS} remaining={remaining} />
        </div>
      </div>
    </div>
  );
}
