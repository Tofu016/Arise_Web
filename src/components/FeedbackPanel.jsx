import { useFeedbackForm } from "../hooks/useFeedbackForm";
import KioskDialog from "./KioskDialog";
import KioskThanks from "./KioskThanks";

// General app/experience feedback — genuinely optional and skippable,
// triggered by its own button rather than shown automatically. Not
// tied to any specific room/office; rating is the only required field,
// matching Feedback_API's own server-side validation (1-5, rejected
// otherwise) — comment, name, and email are all optional there too.
//
// kiosk: render in the kiosk view's dialog (with its keyboard, and the
// OS keyboard suppressed) instead of a centered modal. onFinished (kiosk)
// runs when the post-submit thank-you countdown ends. onSubmitted fires
// right when the rating is accepted by the server, ahead of that countdown
// — the kiosk's End Session button uses it to know feedback is already in
// for this session, even if the visitor then taps "Keep exploring".
export default function FeedbackPanel({ onClose, onFinished, onSubmitted, kiosk = false }) {
  const inputMode = kiosk ? "none" : undefined;
  const f = useFeedbackForm({ onSubmitted });

  const displayRating = f.displayRating;
  const title = f.submitted ? "Thank you!" : "How was your experience?";

  const body = f.submitted ? (
    <p className="feedback-panel-thanks">
      Your feedback helps us improve ARISE. Thanks for taking the time to share it.
    </p>
  ) : (
    <form onSubmit={f.submit}>
      <div
        className="feedback-star-row"
        role="radiogroup"
        aria-label="Rating"
        onPointerDown={f.handleStarPointerDown}
        onPointerMove={f.handleStarPointerMove}
        onPointerUp={f.endStarDrag}
        onPointerCancel={f.endStarDrag}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className="feedback-star"
            data-star={star}
            onClick={() => f.selectStar(star)}
            onMouseEnter={() => f.hoverStar(star)}
            onMouseLeave={f.clearHover}
            aria-label={`${star} star${star === 1 ? "" : "s"}`}
            aria-checked={f.rating === star}
            role="radio"
          >
            {star <= displayRating ? "★" : "☆"}
          </button>
        ))}
      </div>

      <div className="feedback-fields">
        <label>
          Comments (optional)
          <textarea
            value={f.comment}
            onChange={(e) => f.editField("comment", e.target.value)}
            placeholder="What worked well, or what could be better?"
            rows={3}
            inputMode={inputMode}
          />
        </label>

        <div className="feedback-row">
          <label>
            Name (optional)
            <input type="text" value={f.name} onChange={(e) => f.editField("name", e.target.value)} inputMode={inputMode} />
          </label>

          <label>
            Email (optional)
            <input type="email" value={f.email} onChange={(e) => f.editField("email", e.target.value)} inputMode={inputMode} />
          </label>
        </div>

        {f.error && (
          <div className="error-box">
            <p>{f.error}</p>
          </div>
        )}

        <div className="form-actions">
          <button type="submit" className="primary" disabled={f.submitting}>
            {f.submitting ? "Sending…" : "Send Feedback"}
          </button>
          {!kiosk && <button type="button" onClick={onClose}>Cancel</button>}
        </div>
      </div>
    </form>
  );

  if (kiosk) {
    // Kiosk: a finished evaluation gets the small thank-you card, which
    // resets the system (onFinished) when its countdown ends, unless the
    // visitor taps "Keep exploring" (onClose) to cancel that first.
    if (f.submitted) return <KioskThanks onDone={onFinished ?? onClose} onResume={onClose} />;
    return (
      <KioskDialog title={title} titleClassName="kiosk-dialog-title-prompt" keyboard="text" onClose={onClose}>
        <div className="feedback-body">{body}</div>
      </KioskDialog>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal feedback-modal" onClick={(e) => e.stopPropagation()}>
        <div className="preview-header">
          <h3>{title}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="feedback-body">{body}</div>
      </div>
    </div>
  );
}
