import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/useAuth";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // RequireAuth passes along where the visitor was trying to go before being
  // redirected here, so a successful login lands them back where they meant
  // to be instead of always dumping them on the main page.
  const redirectTo = location.state?.from || "/";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email.trim().toLowerCase(), password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      // The backend already returns plain, human-readable error strings
      // (e.g. "Invalid email or password.") — no Firebase-error-code
      // translation needed the way friendlyAuthError() used to provide.
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page auth-page-split">
      <div className="auth-left-panel">
        <h1>
          Welcome to <span className="auth-accent">ARISE</span>
        </h1>
        <p>
          Experience the SDCA campuses through an immersive digital lens.
        </p>
      </div>

      <div className="auth-right-panel">
        <div className="auth-card">
          <h2>Sign in</h2>

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
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <button className="primary" type="submit" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="auth-switch">
            <Link to="/forgot-password">Forgot password?</Link> · <Link to="/forgot-email">Forgot email?</Link>
          </p>
          <p className="auth-switch">
            Need an account? <Link to="/register">Register</Link>
          </p>
        </div>
      </div>

      {error && (
        <div className="modal-overlay" onClick={() => setError("")}>
          <div className="modal warning-modal" onClick={(e) => e.stopPropagation()}>
            <h4>Couldn't sign in</h4>
            <p>{error}</p>
            <button className="primary" onClick={() => setError("")}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
}
