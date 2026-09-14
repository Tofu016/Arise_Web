import { useFeedback } from "../../hooks/useFeedback";

function formatDate(createdAt) {
  if (!createdAt) return "—";
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function Stars({ rating }) {
  return (
    <span className="feedback-admin-stars" aria-label={`${rating} out of 5`}>
      {"★".repeat(rating)}
      <span className="feedback-admin-stars-empty">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

// Same overall structure as UserPanelPage.jsx — a filter row, a
// "-list"/"-row" layout — and deliberately reuses .users-list/.users-row/
// .users-row-main/.users-row-actions directly rather than duplicating
// them under feedback-specific names, since that row layout was never
// actually user-specific to begin with, just generically styled for any
// list of records.
export default function FeedbackAdminPage() {
  const { feedback, markReviewed } = useFeedback();

  const unreviewedCount = feedback.filter((f) => !f.reviewed_at).length;

  // Unreviewed first (the ones needing attention), then most recent
  // first within each group — same "needs action first" ordering
  // UserPanelPage.jsx already uses for pending accounts.
  const sorted = [...feedback].sort((a, b) => {
    if (!a.reviewed_at && b.reviewed_at) return -1;
    if (a.reviewed_at && !b.reviewed_at) return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  return (
    <div className="feedback-admin-page">
      <h2 className="admin-page-heading">
        Feedback
        {unreviewedCount > 0 && <span className="badge-count">{unreviewedCount} new</span>}
      </h2>

      {sorted.length === 0 && <p className="empty-hint">No feedback submitted yet.</p>}

      <div className="users-list">
        {sorted.map((f) => (
          <div key={f.id} className={"users-row" + (!f.reviewed_at ? " users-row-pending" : "")}>
            <div className="users-row-main">
              <Stars rating={f.rating} />
              {f.comment && <span className="feedback-admin-comment">{f.comment}</span>}
              <span className="field-hint">
                {formatDate(f.created_at)}
                {(f.name || f.email) && " · "}
                {f.name}
                {f.name && f.email && " · "}
                {f.email}
                {!f.name && !f.email && " · Anonymous"}
              </span>
            </div>
            <div className="users-row-actions">
              {!f.reviewed_at && (
                <button type="button" className="primary" onClick={() => markReviewed(f.id)}>
                  Mark reviewed
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
