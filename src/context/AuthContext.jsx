import { createContext, useEffect, useState } from "react";
import { apiGet, apiPost } from "../utils/apiClient";

// Only admins can sign in. A registered account is pending until an admin
// approves it, and the backend refuses a pending account at login, so a
// signed-in `user` is always an approved admin and there is no role to check.
export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount (including a page refresh), recover the session from
  // whatever token is already sitting in localStorage, if any.
  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) {
      setLoading(false);
      return;
    }
    apiGet("Auth_API/me")
      .then((data) => setUser(data.user))
      .catch(() => {
        // Token expired, deleted server-side (e.g. after another admin
        // changed this account's password), or otherwise no longer
        // valid: clear it rather than hold onto something that will
        // just keep failing.
        localStorage.removeItem("authToken");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const data = await apiPost("Auth_API/login", { email, password });
    localStorage.setItem("authToken", data.token);
    setUser(data.user);
    return data.user;
  };

  // Does not sign anyone in: the new account is pending until an admin
  // approves it, and login() refuses it until then.
  const register = async (email, password, name) => {
    await apiPost("Auth_API/register", { email, password, name });
  };

  // Always resolves, whether or not the email has an account, so the
  // response can't be used to probe which addresses are registered.
  const forgotPassword = async (email) => {
    await apiPost("Auth_API/forgotPassword", { email });
  };

  // Does not sign anyone in: a reset only changes the password, and the
  // backend invalidates every existing session for the account.
  const resetPassword = async (token, newPassword) => {
    await apiPost("Auth_API/resetPassword", { token, password: newPassword });
  };

  const signOut = async () => {
    try {
      await apiPost("Auth_API/logout", {});
    } catch {
      // Non-fatal: even if the server call fails (token already
      // expired, network hiccup), the admin should still end up signed
      // out on this device.
    } finally {
      localStorage.removeItem("authToken");
      setUser(null);
    }
  };

  const value = {
    user, // { id, email, name }, or null when nobody is signed in
    loading,
    login,
    register,
    forgotPassword,
    resetPassword,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
