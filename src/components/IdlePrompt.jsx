import { useState } from "react";
import { useCountdown } from "../hooks/useCountdown";
import CountdownRing from "./CountdownRing";

export const IDLE_RESTART_SECONDS = 180;

// The "Done exploring?" prompt shown after a period of inactivity.
// Reuses .modal-overlay/.modal directly (same pattern as the app's
// other warning-style modals) for a genuinely locked, centered,
// scrim-backed prompt — unlike those, though, the overlay itself has no
// onClick to dismiss on a backdrop click. This prompt is only ever
// cleared by an explicit choice (one of the buttons below), matching
// "locked until clicked" literally — a stray click outside shouldn't
// count as any choice.
//
// onStartOver (kiosk only): adds a two-tap "Start over" button and a
// visible countdown after which the system restarts on its own.
export default function IdlePrompt({ onContinue, onGiveFeedback, onStartOver }) {
  if (onStartOver) {
    return <KioskIdlePrompt onContinue={onContinue} onGiveFeedback={onGiveFeedback} onStartOver={onStartOver} />;
  }
  return (
    <div className="modal-overlay">
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
    <div className="modal-overlay">
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
