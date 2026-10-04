import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";

const ALLOWED_DOMAIN = "@sdca.edu.ph";

export default function Register() {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const trimmedEmail = email.trim().toLowerCase();

    // Client-side check for immediate feedback, the real enforcement is
    // server-side (register() in Auth_API), same domain rule, checked
    // again regardless of what happens here.
    if (!trimmedEmail.endsWith(ALLOWED_DOMAIN)) {
      setError(`Only ${ALLOWED_DOMAIN} email addresses can register.`);
      return;
    }
    // 8, not 6, matches the backend's actual minimum exactly, so a
    // password that clears this check is guaranteed to clear the
    // server's too, rather than passing here and failing there with a
    // confusing, inconsistent error.
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
      // Registering does not sign anyone in: the account is pending until
      // an admin approves it.
      await register(trimmedEmail, password, name.trim());
      setRegistered(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page auth-page-split">
      <div className="auth-left-panel">
        <h1>
          Join <span className="auth-accent">ARISE</span>
        </h1>
        <p>
          Request an account for the ARISE admin editor. An administrator
          reviews every request before it can sign in.
        </p>
      </div>

      <div className="auth-right-panel">
        <div className="auth-card">
          <h2>Create an account</h2>
          <p className="field-hint">Registration requires an {ALLOWED_DOMAIN} email address.</p>

          {registered ? (
            <p className="auth-info">
              Account created. It is pending approval by an administrator; you will get an email once it is
              approved, and then you can <Link to="/login">sign in</Link>.
            </p>
          ) : (
          <form onSubmit={handleSubmit}>
            <label>
              Name
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Juan Dela Cruz"
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={`you${ALLOWED_DOMAIN}`}
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
            <label>
              Confirm password
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </label>
            <button className="primary" type="submit" disabled={submitting}>
              {submitting ? "Creating account…" : "Register"}
            </button>
          </form>
          )}

          <p className="auth-switch">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>
      </div>

      {error && (
        <div className="modal-overlay" onClick={() => setError("")}>
          <div className="modal warning-modal" onClick={(e) => e.stopPropagation()}>
            <h4>Couldn't register</h4>
            <p>{error}</p>
            <button className="primary" onClick={() => setError("")}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
}
