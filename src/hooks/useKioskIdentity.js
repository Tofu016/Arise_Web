import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "../utils/apiClient";
import { clearKioskToken, getKioskToken, setKioskToken } from "../utils/kioskToken";

// How often a paired kiosk checks in. Doubles as the heartbeat the admin's
// Kiosks page reads as "last seen", and lets a revoked token be noticed
// without a reload.
const HEARTBEAT_MS = 5 * 60 * 1000;

// Who this kiosk is, once an admin has paired the device (Kiosks_API). Only
// the Compact layout has a pairing flow; elsewhere it stays unpaired.
// Returns { kiosk, pair(code), unpair() } where kiosk is null when unpaired
// or when the token was revoked, and otherwise { id, name, nodeId }.
//
// A revoked or unknown token (a 401) quietly becomes "unpaired" and is
// forgotten. Any other failure (the network dropped) keeps what was last
// known, so a blip never makes the Kiosk Location option vanish.
export function useKioskIdentity(enabled) {
  const [kiosk, setKiosk] = useState(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    const check = () => {
      if (!getKioskToken()) return;
      apiGet("Kiosks_API/me")
        .then(({ kiosk: me }) => {
          if (!cancelled) setKiosk({ id: me.id, name: me.name, nodeId: me.node_id });
        })
        .catch((err) => {
          if (err.status !== 401) return;
          clearKioskToken();
          if (!cancelled) setKiosk(null);
        });
    };
    check();
    const timer = setInterval(check, HEARTBEAT_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled]);

  // Rejects with the server's message (wrong, expired or locked out) so the
  // pairing screen can show it.
  const pair = useCallback(async (code) => {
    const { token, kiosk: me } = await apiPost("Kiosks_API/pair", { code }, "Couldn't pair this kiosk.");
    setKioskToken(token);
    setKiosk({ id: me.id, name: me.name, nodeId: me.node_id });
  }, []);

  const unpair = useCallback(async () => {
    try {
      await apiPost("Kiosks_API/unpair", {});
    } catch {
      // The token is forgotten here either way; the admin can reset the record.
    }
    clearKioskToken();
    setKiosk(null);
  }, []);

  return { kiosk, pair, unpair };
}
