// The "Done exploring?" prompt shown after a period of inactivity.
// Reuses .modal-overlay/.modal directly (same pattern as the app's
// other warning-style modals) for a genuinely locked, centered,
// scrim-backed prompt — unlike those, though, the overlay itself has no
// onClick to dismiss on a backdrop click. This prompt is only ever
// cleared by an explicit choice (one of the two buttons below), matching
// "locked until clicked" literally — a stray click outside shouldn't
// count as either choice.
export default function IdlePrompt({ onContinue, onGiveFeedback }) {
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
