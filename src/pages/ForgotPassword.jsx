import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";

// A generic, identical confirmation message is shown regardless of whether
// the email actually has an account — revealing "no account with that
// email" would let anyone probe for which addresses are registered
// (account enumeration). The backend's own forgotPassword endpoint always
// succeeds either way — see AuthContext.jsx's forgotPassword comment —
// so there's no separate "not found" case to swallow here anymore.
const GENERIC_SENT_MESSAGE =
  "If an account exists for that email, a password reset link has been sent. Check your inbox (and spam folder).";

export default function ForgotPassword() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await forgotPassword(email.trim().toLowerCase());
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card auth-card-centered">
        <div className="auth-icon-badge">🔑</div>
        <h1>Reset your password</h1>
        <p className="field-hint">
          Enter the email you registered with and we'll send a link to reset your password.
        </p>

        {sent ? (
          <p className="auth-info">{GENERIC_SENT_MESSAGE}</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </label>
            <button className="primary" type="submit" disabled={submitting}>
              {submitting ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <p className="auth-switch">
          <Link to="/login">Back to sign in</Link> · <Link to="/forgot-email">Forgot your email instead?</Link>
        </p>
      </div>

      {error && (
        <div className="modal-overlay" onClick={() => setError("")}>
          <div className="modal warning-modal" onClick={(e) => e.stopPropagation()}>
            <h4>Couldn't send reset link</h4>
            <p>{error}</p>
            <button className="primary" onClick={() => setError("")}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
}
