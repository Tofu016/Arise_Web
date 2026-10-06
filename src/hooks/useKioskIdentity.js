import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "../utils/apiClient";
import { clearKioskToken, getKioskToken, setKioskToken } from "../utils/kioskToken";

// How often a paired kiosk checks in. Doubles as the heartbeat the admin's
// Kiosks page reads as "last seen", and lets a revoked token be noticed
// without a reload.
const HEARTBEAT_MS = 5 * 60 * 1000;

// The last identity seen, kept across the visitor view's remounts (every
// session boundary remounts it) so a paired kiosk is recognised at once
// instead of after each remount's round trip. Re-checked on every mount.
let lastKnown = null;

// Who this kiosk is, once an admin has paired the device (Kiosks_API). Only a
// compact screen has a pairing flow (the gesture on the Mobile web layout, or
// on the Compact layout itself to check or unpair); elsewhere it stays unpaired.
// Returns { kiosk, paired, ready, pair(code), unpair() } where kiosk is null
// when unpaired or when the token was revoked, and otherwise { id, name, nodeId }.
// `paired` is whether a token is stored, known at once without a round trip,
// so a paired kiosk boots straight into the Compact layout (and stays there
// through a network blip); it drops only when the token is revoked or unpaired.
// `ready` is false only while a stored token has not been checked yet, so
// callers that must know paired-or-not (analytics) can wait for it.
//
// A revoked or unknown token (a 401) quietly becomes "unpaired" and is
// forgotten. Any other failure (the network dropped) keeps what was last
// known, so a blip never makes the Kiosk Location option vanish.
export function useKioskIdentity(enabled) {
  const hasToken = enabled && !!getKioskToken();
  const [kiosk, setKioskState] = useState(hasToken ? lastKnown : null);
  const [checked, setChecked] = useState(!hasToken || lastKnown !== null);
  // Read regardless of `enabled`, so a device that mounted on a wide screen
  // still knows it is paired once the screen turns compact.
  const [tokenStored, setTokenStored] = useState(() => !!getKioskToken());
  const setKiosk = useCallback((next) => {
    lastKnown = next;
    setKioskState(next);
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    const check = () => {
      if (!getKioskToken()) return;
      apiGet("Kiosks_API/me")
        .then(({ kiosk: me }) => {
          if (cancelled) return;
          setKiosk({ id: me.id, name: me.name, nodeId: me.node_id });
          setChecked(true);
        })
        .catch((err) => {
          if (cancelled) return;
          if (err.status === 401) {
            clearKioskToken();
            setTokenStored(false);
            setKiosk(null);
          }
          // A network failure keeps what was last known (null at worst).
          setChecked(true);
        });
    };
    check();
    const timer = setInterval(check, HEARTBEAT_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled, setKiosk]);

  // Rejects with the server's message (wrong, expired or locked out) so the
  // pairing screen can show it.
  const pair = useCallback(async (code) => {
    const { token, kiosk: me } = await apiPost("Kiosks_API/pair", { code }, "Couldn't pair this kiosk.");
    setKioskToken(token);
    setTokenStored(true);
    setKiosk({ id: me.id, name: me.name, nodeId: me.node_id });
  }, [setKiosk]);

  const unpair = useCallback(async () => {
    try {
      await apiPost("Kiosks_API/unpair", {});
    } catch {
      // The token is forgotten here either way; the admin can reset the record.
    }
    clearKioskToken();
    setTokenStored(false);
    setKiosk(null);
  }, [setKiosk]);

  return { kiosk, paired: enabled && tokenStored, ready: checked || !hasToken, pair, unpair };
}
