import { useState } from "react";

const ROLES = ["pending", "user", "admin"];

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

  const handleCreate = async () => {
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
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="preview-header">
          <h3>New Account</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@sdca.edu.ph"
            autoFocus
          />
        </label>

        <label>
          Name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </label>

        <label>
          Role
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <span className="field-hint">
            Unlike self-registration, this account skips "pending" if you choose "user" or "admin" here.
          </span>
        </label>

        {error && (
          <div className="error-box">
            <p>{error}</p>
          </div>
        )}

        <div className="form-actions">
          <button
            type="button"
            className="primary"
            onClick={handleCreate}
            disabled={creating || !email.trim() || !name.trim() || !password}
          >
            {creating ? "Creating…" : "Create account"}
          </button>
          <button type="button" className="admin-btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
