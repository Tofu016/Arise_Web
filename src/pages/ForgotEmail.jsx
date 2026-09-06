import { Link } from "react-router-dom";

// Deliberately not a self-service lookup — see ForgotPassword.jsx's comment
// for why: letting someone submit a name/detail and get back "here's the
// registered email" is an account-enumeration risk, and this app doesn't
// collect a separate recovery identifier at registration anyway (your
// @sdca.edu.ph email effectively *is* your identity here). An admin looking
// you up by name in the Users panel is the safe equivalent.
export default function ForgotEmail() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Forgot your email?</h1>

        <p className="auth-info">
          Accounts here are registered with your own <strong>@sdca.edu.ph</strong> email —
          there's no separate username to look up. A few things that usually help:
        </p>

        <ul className="auth-info-list">
          <li>Check for a welcome or approval email from ARISE in your school inbox.</li>
          <li>Try the most likely variation of your name — e.g. <code>firstname.lastname@sdca.edu.ph</code>.</li>
          <li>Check your school's webmail/portal for your official assigned address.</li>
        </ul>

        <p className="auth-info">
          Still stuck? An administrator can look your account up by name from the admin
          Users panel — reach out to one directly, or contact your school's IT/registrar
          office if you're not sure who that is.
        </p>

        <p className="auth-switch">
          <Link to="/login">Back to sign in</Link> · <Link to="/forgot-password">Forgot your password instead?</Link>
        </p>
      </div>
    </div>
  );
}
