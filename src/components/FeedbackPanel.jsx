import { useRef, useState } from "react";
import { apiPost } from "../utils/apiClient";
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
// runs when the post-submit thank-you countdown ends.
export default function FeedbackPanel({ onClose, onFinished, kiosk = false }) {
  const inputMode = kiosk ? "none" : undefined;
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const draggingRef = useRef(false);

  // Lets a visitor drag/slide across the row to pick a rating instead of
  // requiring a precise tap on one star — friendlier on the kiosk touchscreen.
  const starAtPoint = (clientX, clientY) => {
    const el = document.elementFromPoint(clientX, clientY)?.closest("[data-star]");
    return el ? Number(el.dataset.star) : null;
  };

  const handleStarPointerDown = (e) => {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const star = starAtPoint(e.clientX, e.clientY);
    if (star) {
      setRating(star);
      setHoverRating(star);
    }
  };

  const handleStarPointerMove = (e) => {
    if (!draggingRef.current) return;
    const star = starAtPoint(e.clientX, e.clientY);
    if (star) {
      setRating(star);
      setHoverRating(star);
    }
  };

  const endStarDrag = () => {
    draggingRef.current = false;
    setHoverRating(0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating < 1) {
      setError("Please select a rating.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await apiPost("Feedback_API/submit", {
        rating,
        comment: comment.trim() || undefined,
        name: name.trim() || undefined,
        email: email.trim() || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err.message || "Couldn't submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const displayRating = hoverRating || rating;
  const title = submitted ? "Thank you!" : "How was your experience?";

  const body = submitted ? (
    <p className="feedback-panel-thanks">
      Your feedback helps us improve ARISE — thanks for taking the time to share it.
    </p>
  ) : (
    <form onSubmit={handleSubmit}>
      <div
        className="feedback-star-row"
        role="radiogroup"
        aria-label="Rating"
        onPointerDown={handleStarPointerDown}
        onPointerMove={handleStarPointerMove}
        onPointerUp={endStarDrag}
        onPointerCancel={endStarDrag}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className="feedback-star"
            data-star={star}
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            aria-label={`${star} star${star === 1 ? "" : "s"}`}
            aria-checked={rating === star}
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
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What worked well, or what could be better?"
            rows={3}
            inputMode={inputMode}
          />
        </label>

        <div className="feedback-row">
          <label>
            Name (optional)
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} inputMode={inputMode} />
          </label>

          <label>
            Email (optional)
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} inputMode={inputMode} />
          </label>
        </div>

        {error && (
          <div className="error-box">
            <p>{error}</p>
          </div>
        )}

        <div className="form-actions">
          <button type="submit" className="primary" disabled={submitting}>
            {submitting ? "Sending…" : "Send Feedback"}
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
    if (submitted) return <KioskThanks onDone={onFinished ?? onClose} onResume={onClose} />;
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
