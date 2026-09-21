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
      onClick={onStart}
      tabIndex={hidden ? -1 : 0}
      aria-hidden={hidden}
    >
      <span className="kiosk-start-title">ARISE</span>
      <span className="kiosk-start-prompt">Tap to Start</span>
    </button>
  );
}
