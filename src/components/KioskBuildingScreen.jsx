import { campusForBuilding } from "../utils/constants";
import { KIOSK_RAISED_STYLE } from "../utils/kioskLayout";

// The kiosk's building selection screen, shown after a multi-building
// campus is picked on the campus screen (see KioskCampusScreen) and
// covering the whole viewport like it — a solo-building campus skips this
// screen entirely. Lists every building sharing the picked campusId
// (resolved dynamically via utils/constants.js's campusForBuilding, not a
// hardcoded id — today that's GD1/GD2/GD3 under "main", but any campus an
// admin groups multiple buildings under works the same way), plus Campus
// Entrance as its own first entry — the one node an admin flagged as the
// shared entrance for that whole campus cluster (see NodeForm's "Campus
// entrance" toggle), landing directly without a floor to pick. Picking a
// building instead moves on to its own floor screen. Stays mounted so the
// fade can play and CSS makes it inert afterwards.
//
// buildings: [{ id, label }]; available: ids that have nodes to land on.
// campusId: the campus this screen is listing buildings for.
// campusEntranceNodeId: that campus's entrance node, or null if none is
// flagged yet.
export default function KioskBuildingScreen({ hidden, buildings, available, campusId, campusEntranceNodeId, onPick, onPickEntrance, onBack }) {
  const campusBuildings = buildings.filter((b) => campusForBuilding(b.id) === campusId);

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
        <div className="kiosk-building-column">{campusBuildings.map(renderButton)}</div>
      </div>
    </div>
  );
}
