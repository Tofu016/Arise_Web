import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/useAuth";

// New page — there was no equivalent of this in the original app at
// all. Firebase's sendPasswordResetEmail() sends people to Firebase's
// own hosted reset page by default, so a custom in-app "enter your new
// password" page was never actually needed before now. The reset link
// Auth_API::forgotPassword queues points at /reset-password?token=...,
// which needed a real route and page to actually receive it.
//
// A successful reset does NOT log the user in — see
// AuthContext.jsx's own resetPassword comment for why — so this ends
// with a link back to /login, not an automatic redirect into the app.
export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const { resetPassword } = useAuth();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // A missing token means someone navigated here directly rather than
  // through a real emailed link — nothing to actually reset against.
  if (!token) {
    return (
      <div className="auth-page">
        <div className="auth-card auth-card-centered">
          <div className="auth-icon-badge">⚠️</div>
          <h1>Invalid reset link</h1>
          <p className="field-hint">
            This link is missing its reset token — please use the link from your password reset email,
            or request a new one.
          </p>
          <p className="auth-switch">
            <Link to="/forgot-password">Request a new reset link</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card auth-card-centered">
        <div className="auth-icon-badge">🔑</div>
        <h1>Choose a new password</h1>

        {done ? (
          <>
            <p className="auth-info">
              Your password has been reset. Any other devices you were signed in on have been signed out,
              as a precaution.
            </p>
            <button className="primary" onClick={() => navigate("/login", { replace: true })}>
              Sign in
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <label>
              New password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
              />
            </label>
            <label>
              Confirm new password
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </label>
            <button className="primary" type="submit" disabled={submitting}>
              {submitting ? "Resetting…" : "Reset password"}
            </button>
          </form>
        )}

        <p className="auth-switch">
          <Link to="/login">Back to sign in</Link>
        </p>
      </div>

      {error && (
        <div className="modal-overlay" onClick={() => setError("")}>
          <div className="modal warning-modal" onClick={(e) => e.stopPropagation()}>
            <h4>Couldn't reset password</h4>
            <p>{error}</p>
            <button className="primary" onClick={() => setError("")}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
}
