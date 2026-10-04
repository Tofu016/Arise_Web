// The token a paired kiosk was given (see hooks/useKioskIdentity.js). Kept in
// localStorage so it survives reloads; clearing the browser's site data
// unpairs the device, which the pairing gesture can undo. Every access is
// guarded, since storage can be blocked or throw.
const KEY = "kioskToken";

export function getKioskToken() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setKioskToken(token) {
  try {
    localStorage.setItem(KEY, token);
  } catch {
    // Not paired this session; the visitor sees no Kiosk Location.
  }
}

export function clearKioskToken() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing stored that could be cleared.
  }
}
