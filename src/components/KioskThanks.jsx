import { KIOSK_TOP_INSET, KIOSK_PANORAMA_FRACTION, KIOSK_CARD_CENTER } from "../utils/kioskLayout";
import { useCountdown } from "../hooks/useCountdown";
import CountdownRing from "./CountdownRing";

export const KIOSK_THANKS_SECONDS = 5;

// Shown on the kiosk after feedback is sent: a small card, centered
// horizontally, whose vertical center sits at the middle of the dialog grid. Counts down, then calls onDone (the system reset).
// A scrim over the band keeps stray taps off the panorama meanwhile.
export default function KioskThanks({ onDone }) {
  const remaining = useCountdown(KIOSK_THANKS_SECONDS, onDone);

  const centerVh = KIOSK_CARD_CENTER * 100;

  return (
    <>
      <div
        className="kiosk-dialog-scrim"
        style={{ top: `${KIOSK_TOP_INSET * 100}%`, bottom: `${(1 - KIOSK_TOP_INSET - KIOSK_PANORAMA_FRACTION) * 100}%` }}
      />
      <div className="kiosk-thanks" role="dialog" aria-live="polite" style={{ top: `${centerVh}vh` }}>
        <p className="kiosk-thanks-title">Thank you for evaluating ARISE.</p>
        <div className="kiosk-thanks-countdown">
          <span>Starting over in</span>
          <CountdownRing total={KIOSK_THANKS_SECONDS} remaining={remaining} />
        </div>
      </div>
    </>
  );
}
