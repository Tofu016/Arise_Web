// crypto.randomUUID() only exists in secure contexts (HTTPS, or the
// localhost exception) — dev/kiosk testing over plain http://<LAN-ip>
// is not secure, so it's undefined there. These ids just need to be unique,
// not cryptographically random, so fall back to a manual UUID v4.
export function uuid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
