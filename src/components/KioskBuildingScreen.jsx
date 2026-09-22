import { BUILDINGS } from "../utils/constants";
import { KIOSK_RAISED_STYLE } from "../utils/kioskLayout";

const BUILT_IN_IDS = BUILDINGS.map((b) => b.id);

// The kiosk's building selection screen, shown after the start screen and
// covering the whole viewport like it. Left: the built-in GD1/GD2/GD3
// (physically interconnected). Right: every other building — today just
// Digital Campus, later any admin-added ones. Picking one (onPick) lands the
// visitor at that building's default start — see pickBuildingStart — and the
// screen fades out. Stays mounted so the fade can play and CSS makes it inert
// afterwards.
//
// buildings: [{ id, label }]; available: ids that have nodes to land on.
export default function KioskBuildingScreen({ hidden, buildings, available, onPick }) {
  const left = buildings.filter((b) => BUILT_IN_IDS.includes(b.id));
  const right = buildings.filter((b) => !BUILT_IN_IDS.includes(b.id));

  const renderButton = (b) => (
    <button
      key={b.id}
      type="button"
      className="kiosk-building-btn"
      disabled={!available.has(b.id)}
      onClick={(e) => {
        // Otherwise this button stays focused after the screen's own
        // aria-hidden flips true on the next render — a focused element
        // can't be hidden from assistive tech, so the browser refuses and
        // logs a console warning about it.
        e.currentTarget.blur();
        onPick(b.id);
      }}
    >
      {b.label}
    </button>
  );

  return (
    <div
      className={"kiosk-building-screen" + (hidden ? " kiosk-building-screen-hidden" : "")}
      style={KIOSK_RAISED_STYLE}
      aria-hidden={hidden}
    >
      <h2 className="kiosk-building-title">Choose a building</h2>
      <div className="kiosk-building-columns">
        <div className="kiosk-building-column">{left.map(renderButton)}</div>
        <div className="kiosk-building-column">{right.map(renderButton)}</div>
      </div>
    </div>
  );
}
