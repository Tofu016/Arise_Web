// Maps Firebase Auth error codes to plain-language messages — the raw
// "Firebase: Error (auth/wrong-password)." text isn't something to show
// someone trying to log in.
const MESSAGES = {
  "auth/email-already-in-use": "That email is already registered — try signing in instead.",
  "auth/invalid-email": "That doesn't look like a valid email address.",
  "auth/weak-password": "Password is too weak — use at least 6 characters.",
  "auth/user-not-found": "No account found with that email.",
  "auth/wrong-password": "Incorrect password.",
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/too-many-requests": "Too many attempts — please wait a moment and try again.",
  "auth/network-request-failed": "Network error — check your connection and try again.",
  // A known Firebase SDK limitation (firebase-js-sdk#8054): when the
  // enforceEmailDomain blocking Cloud Function rejects a sign-up, the SDK
  // shows this generic code instead of the function's real error message.
  // In practice this always means the same thing here — the email didn't
  // pass the @sdca.edu.ph check.
  "auth/error-code:-47": "Registration was rejected — double check you used your exact @sdca.edu.ph email, with no typos.",
};

export function friendlyAuthError(err) {
  return MESSAGES[err?.code] || err?.message || "Something went wrong. Please try again.";
}
