import { KIOSK_RAISED_STYLE } from "../utils/kioskLayout";

// The kiosk's attract screen: covers the whole viewport (header and bottom
// whitespace included) until tapped, then fades out. Placeholder art — a
// plain white screen with the name and prompt — until the real graphic
// exists. Stays mounted once hidden so the fade can play; CSS makes it
// inert (no pointer events) afterwards.
export default function KioskStartScreen({ hidden, onStart }) {
  return (
    <button
      type="button"
      className={"kiosk-start-screen" + (hidden ? " kiosk-start-screen-hidden" : "")}
      style={KIOSK_RAISED_STYLE}
      onClick={(e) => {
        // Otherwise this button — the whole screen — stays focused after
        // aria-hidden flips true on the next render, which the browser
        // rightly refuses to apply (a focused element can't be hidden
        // from assistive tech) and logs a console warning about.
        e.currentTarget.blur();
        onStart();
      }}
      tabIndex={hidden ? -1 : 0}
      aria-hidden={hidden}
    >
      <span className="kiosk-start-title">ARISE</span>
      <span className="kiosk-start-prompt">Tap to Start</span>
    </button>
  );
}
