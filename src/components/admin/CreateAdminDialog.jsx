import { useState } from "react";
import IconPlaceholder from "../IconPlaceholder";

// Admin-only account creation (Admins_API/create). There is no sign-up
// page and no approval step: every account made here is an admin and can
// sign in immediately.
export default function CreateAdminDialog({ onClose, createAdmin }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const canSubmit = !creating && email.trim() && name.trim() && password;

  // A real <form> so Enter in any field submits, the same as the login page.
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    setCreating(true);
    try {
      await createAdmin({ email: email.trim(), name: name.trim(), password });
      onClose();
    } catch (err) {
      setError(err.message || "Couldn't create the account.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form
        className="modal create-user-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        aria-labelledby="create-user-title"
      >
        <div className="preview-header">
          <h3 id="create-user-title">New Account</h3>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close">
            <IconPlaceholder name="close" className="create-user-close-icon" />
          </button>
        </div>

        <p className="field-hint">
          Every account can sign in to this admin editor, including the User Panel.
        </p>

        <label className="create-user-field">
          Full name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Juan Dela Cruz"
            autoComplete="off"
            autoFocus
          />
        </label>

        <label className="create-user-field">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@sdca.edu.ph"
            autoComplete="off"
          />
        </label>

        <label className="create-user-field">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
        </label>

        {error && (
          <div className="error-box">
            <p>{error}</p>
          </div>
        )}

        <div className="form-actions create-user-actions">
          <button type="button" className="admin-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={!canSubmit}>
            {creating ? "Creating…" : "Create account"}
          </button>
        </div>
      </form>
    </div>
  );
}
