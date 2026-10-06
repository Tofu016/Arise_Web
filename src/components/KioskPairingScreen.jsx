import { useState } from "react";
import OnScreenKeyboard from "./OnScreenKeyboard";
import { KIOSK_RAISED_STYLE } from "../utils/kioskLayout";

// Reached only by a hidden tap gesture (utils/kioskPairingGesture.js), never
// from a visible control: on the Mobile web layout (where an unpaired kiosk
// device starts) to pair it, and on the Compact layout to check or unpair it.
// Unpaired: type the 8-digit code an admin generated on the Kiosks page.
// Paired: shows which kiosk this is, with a way to unpair. A small centered
// modal rather than a KioskDialog: it needs a keypad, not the full keyboard,
// so the dialog's half-screen footprint would only be empty space. Back (or a
// tap on the scrim) returns to where the visitor was.
// `nativeKeyboard` (Mobile web layout): the device's own number keyboard
// instead of the on-screen keypad, and a plain centered modal.
export default function KioskPairingScreen({ kiosk, onPair, onUnpair, onClose, nativeKeyboard = false }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await onPair(code);
      setCode("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={"modal-overlay" + (nativeKeyboard ? "" : " kiosk-raised-overlay")}
      style={nativeKeyboard ? undefined : KIOSK_RAISED_STYLE}
      onClick={onClose}
    >
      <div className="modal kiosk-pairing-modal" role="dialog" aria-label="Pair this kiosk" onClick={(e) => e.stopPropagation()}>
        <h3>Pair this kiosk</h3>
        {kiosk ? (
          <>
            <p className="kiosk-pairing-status">Paired as <strong>{kiosk.name}</strong>.</p>
            <div className="form-actions">
              <button type="button" onClick={onClose}>Back</button>
              <button type="button" onClick={onUnpair}>Unpair this kiosk</button>
            </div>
          </>
        ) : (
          <>
            <input
              type="text"
              className="kiosk-pairing-code"
              inputMode={nativeKeyboard ? "numeric" : "none"}
              pattern={nativeKeyboard ? "[0-9]*" : undefined}
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
              placeholder="00000000"
              aria-label="Pairing code"
              autoFocus
            />
            {error && <p className="directions-error">{error}</p>}
            {!nativeKeyboard && <OnScreenKeyboard layout="numeric" />}
            <div className="form-actions">
              <button type="button" onClick={onClose}>Back</button>
              <button type="button" className="primary" onClick={submit} disabled={busy || code.length < 8}>
                {busy ? "Pairing..." : "Pair"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
