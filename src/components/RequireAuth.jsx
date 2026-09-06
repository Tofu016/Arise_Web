import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/useAuth";

// Wraps a route element to require sign-in, and optionally a minimum role.
//  - Not signed in                -> redirect to /login (remembers where to return to)
//  - Signed in but role "pending" -> "awaiting approval" screen, not a redirect loop
//  - requireRole="admin" set and role isn't "admin" -> "not authorized" screen
export default function RequireAuth({ children, requireRole }) {
  const location = useLocation();
  const { user, profile, role, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="auth-status">
        <p>Loading…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (!profile || role === "pending") {
    return (
      <div className="auth-status">
        <h2>Awaiting approval</h2>
        <p>
          Your account (<strong>{user.email}</strong>) has been created but hasn't been approved
          by an admin yet.
        </p>
        <p className="field-hint">Check back soon, or contact an administrator.</p>
        <button onClick={signOut}>Sign out</button>
      </div>
    );
  }

  if (requireRole && role !== requireRole) {
    return (
      <div className="auth-status">
        <h2>Not authorized</h2>
        <p>Your account doesn't have access to this page.</p>
        <button onClick={signOut}>Sign out</button>
      </div>
    );
  }

  return children;
}
