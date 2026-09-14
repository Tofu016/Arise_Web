import { useState } from "react";
import { apiPost } from "../utils/apiClient";

// General app/experience feedback — genuinely optional and skippable,
// triggered by its own button rather than shown automatically. Not
// tied to any specific room/office; rating is the only required field,
// matching Feedback_API's own server-side validation (1-5, rejected
// otherwise) — comment, name, and email are all optional there too.
export default function FeedbackPanel({ onClose }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal feedback-modal" onClick={(e) => e.stopPropagation()}>
        <div className="preview-header">
          <h3>{submitted ? "Thank you!" : "How was your experience?"}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {submitted ? (
          <p className="feedback-panel-thanks">
            Your feedback helps us improve ARISE — thanks for taking the time to share it.
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="feedback-star-row" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className="feedback-star"
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

            <label>
              Comments (optional)
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="What worked well, or what could be better?"
                rows={3}
              />
            </label>

            <label>
              Name (optional)
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
            </label>

            <label>
              Email (optional)
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>

            {error && (
              <div className="error-box">
                <p>{error}</p>
              </div>
            )}

            <div className="form-actions">
              <button type="submit" className="primary" disabled={submitting}>
                {submitting ? "Sending…" : "Send Feedback"}
              </button>
              <button type="button" onClick={onClose}>Cancel</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
