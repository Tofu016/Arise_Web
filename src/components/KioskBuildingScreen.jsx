import { BUILDINGS } from "../utils/constants";
import { KIOSK_RAISED_STYLE } from "../utils/kioskLayout";

const BUILT_IN_IDS = BUILDINGS.map((b) => b.id);

// The kiosk's building selection screen, shown after Main Campus is picked
// on the campus screen (see KioskCampusScreen) and covering the whole
// viewport like it — every other campus is a single building and skips this
// screen entirely. Lists the built-in GD1/GD2/GD3 (physically
// interconnected), plus Campus Entrance as its own first entry — the one
// node an admin flagged as the shared entrance for the whole Main Campus
// cluster (see NodeForm's "Campus entrance" toggle), landing directly
// without a floor to pick. Picking a building instead moves on to its own
// floor screen. Stays mounted so the fade can play and CSS makes it inert
// afterwards.
//
// buildings: [{ id, label }]; available: ids that have nodes to land on.
// campusEntranceNodeId: the Main Campus entrance node, or null if none is
// flagged yet.
export default function KioskBuildingScreen({ hidden, buildings, available, campusEntranceNodeId, onPick, onPickEntrance, onBack }) {
  const mainCampusBuildings = buildings.filter((b) => BUILT_IN_IDS.includes(b.id));

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
      {/* Otherwise a pressed button here stays focused after the campus
          screen's own aria-hidden flips true on the next render — a
          focused element can't be hidden from assistive tech, so the
          browser refuses and logs a console warning about it. */}
      <button
        type="button"
        className="kiosk-back-btn"
        onClick={(e) => {
          e.currentTarget.blur();
          onBack();
        }}
        tabIndex={hidden ? -1 : 0}
      >
        ← Back
      </button>
      <h2 className="kiosk-building-title">Select a Building</h2>
      <div className="kiosk-building-columns">
        <div className="kiosk-building-column">
          <button
            type="button"
            className="kiosk-building-btn kiosk-entrance-btn"
            disabled={!campusEntranceNodeId}
            onClick={(e) => {
              e.currentTarget.blur();
              onPickEntrance(campusEntranceNodeId);
            }}
          >
            Campus Entrance
          </button>
        </div>
        <div className="kiosk-building-column">{mainCampusBuildings.map(renderButton)}</div>
      </div>
    </div>
  );
}
