import { createContext, useEffect, useState } from "react";
import { apiGet, apiPost } from "../utils/apiClient";

// Rewritten to call the new PHP backend instead of Firebase. Firebase
// split identity into two things — `user` (the Auth session) and
// `profile` (the matching Firestore doc) — because those were
// genuinely two separate systems. Our backend's users table already
// combines both into one record, so `user` and `profile` are the same
// object here. Both keys are kept anyway so RequireAuth.jsx's existing
// checks (!profile, role === "pending", user.email) keep working
// completely unchanged — this file is the only thing that needed to
// know the two systems merged.
//
// The token-refresh-on-role-change dance from the Firebase version is
// gone entirely, not just simplified — that existed purely to sync a
// Firestore-side role into a *separate* auth-token-claims system
// (kept in sync by the syncUserRoleClaim Cloud Function). A session
// here just re-checks the role directly; there's no second system left
// to keep in sync.
//
// login() is new — Firebase's global onAuthStateChanged listener used
// to pick up a sign-in from anywhere automatically; a REST API has no
// equivalent implicit mechanism, so Login.jsx now calls this directly.
//
// withUid: adds a `uid` alias matching Firebase Auth's own field name,
// aliasing our backend's `id`. UserPanelPage.jsx compares
// `u.uid === currentUser?.uid` to stop an admin from deleting or
// changing their own role — without this alias, that comparison would
// silently always be false (this object never actually had a `.uid`
// field at all), quietly disabling that safeguard rather than throwing
// an obvious error.
function withUid(user) {
  return user ? { ...user, uid: user.id } : user;
}

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount (including a page refresh), recover the session from
  // whatever token is already sitting in localStorage, if any — this is
  // the actual reason Auth_API/me needed to exist: there was previously
  // no way to answer "am I still logged in, and as who" without it.
  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) {
      setLoading(false);
      return;
    }
    apiGet("Auth_API/me")
      .then((data) => setUser(withUid(data.user)))
      .catch(() => {
        // Token expired, deleted server-side (e.g. after a password
        // reset), or otherwise no longer valid — clear it rather than
        // hold onto something that will just keep failing.
        localStorage.removeItem("authToken");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const data = await apiPost("Auth_API/login", { email, password });
    localStorage.setItem("authToken", data.token);
    setUser(withUid(data.user));
    return data.user;
  };

  // New accounts always start as "pending" server-side, regardless of
  // anything sent here — matches Register.jsx's original behavior
  // exactly. Also matches login's real Firebase behavior: the account
  // is genuinely signed in immediately (a real token, right away), not
  // waiting on approval first — RequireAuth.jsx's own "awaiting
  // approval" screen is what gates a pending account, same as before.
  const register = async (email, password, name) => {
    const data = await apiPost("Auth_API/register", { email, password, name });
    localStorage.setItem("authToken", data.token);
    setUser(withUid(data.user));
    return data.user;
  };

  // Always resolves successfully, whether or not the email actually
  // has an account — the backend's own anti-enumeration protection
  // (see Auth_API::forgotPassword), so there's no separate
  // "user-not-found" case to special-case here the way Firebase's
  // version needed.
  const forgotPassword = async (email) => {
    await apiPost("Auth_API/forgotPassword", { email });
  };

  // Deliberately doesn't touch `user`/localStorage's token at all — a
  // successful reset doesn't log you in, it just changes the password;
  // logging in afterward is a separate, normal login() call. This also
  // matches the backend's own behavior: resetPassword invalidates every
  // existing login session for the account (in case the old password
  // was compromised), so there'd be nothing valid to keep signed in to
  // even if this tried.
  const resetPassword = async (token, newPassword) => {
    await apiPost("Auth_API/resetPassword", { token, password: newPassword });
  };

  const signOut = async () => {
    try {
      await apiPost("Auth_API/logout", {});
    } catch {
      // Non-fatal — even if the server call fails (token already
      // expired, network hiccup), the user should still end up signed
      // out on this device.
    } finally {
      localStorage.removeItem("authToken");
      setUser(null);
    }
  };

  const value = {
    user, // our own user object: { id, uid, email, name, role }, or null
          // (uid aliases id — see withUid's own comment for why)
    profile: user, // see file comment — same object, kept as a
                   // separate key so existing consumers need no changes
    role: user?.role ?? null, // "pending" | "user" | "admin" | null
    loading,
    login,
    register,
    forgotPassword,
    resetPassword,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
