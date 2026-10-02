import { useState } from "react";
import IconPlaceholder from "../IconPlaceholder";

// Order and copy match README's "Accounts & roles" table. Shown as
// described radio cards rather than a bare <select> of role ids, since
// the role is the one choice here whose consequence isn't obvious from
// its name alone (e.g. "user" grants nothing beyond public access).
const ROLE_OPTIONS = [
  { id: "admin", label: "Admin", description: "Full access to this admin editor, including the User Panel." },
  { id: "user", label: "User", description: "No admin access. Same as a public visitor for now." },
  { id: "pending", label: "Pending", description: "Waits for an admin to approve it, like a self-registered account." },
];

// Admin-only account creation (Users_API/create) — distinct from the
// public /register flow, which always lands new accounts on "pending".
// Here the admin is the approval, so the account can be created straight
// into "user" or "admin".
export default function CreateUserDialog({ onClose, createUser }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("admin");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const canSubmit = !creating && email.trim() && name.trim() && password;

  // A real <form> so Enter in any field submits, the same as the auth pages.
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    setCreating(true);
    try {
      await createUser({ email: email.trim(), name: name.trim(), password, role });
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

        <fieldset className="create-user-roles">
          <legend>Role</legend>
          {ROLE_OPTIONS.map((opt) => (
            <label
              key={opt.id}
              className={"create-user-role" + (role === opt.id ? " create-user-role-active" : "")}
            >
              <input
                type="radio"
                name="create-user-role"
                value={opt.id}
                checked={role === opt.id}
                onChange={() => setRole(opt.id)}
              />
              <span className="create-user-role-text">
                <span className="create-user-role-label">{opt.label}</span>
                <span className="create-user-role-desc">{opt.description}</span>
              </span>
            </label>
          ))}
        </fieldset>

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
