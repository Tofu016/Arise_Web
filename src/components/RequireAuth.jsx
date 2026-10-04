import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/useAuth";

// Wraps a route element to require a signed-in admin. Only admins can sign
// in at all, so there is no role to check:
//  - Not signed in -> redirect to /login (remembers where to return to)
export default function RequireAuth({ children }) {
  const location = useLocation();
  const { user, loading } = useAuth();

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

  return children;
}
