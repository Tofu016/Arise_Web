import { floorLabel } from "../utils/constants";
import { KIOSK_RAISED_STYLE } from "../utils/kioskLayout";

// The kiosk's floor selection screen, shown after a building is picked and
// covering the whole viewport like the screens before it. MainPage never
// puts the session in this stage for a building with only one floor to
// land on, so it's skipped without ever appearing in that case — see
// utils/kioskSession.js.
//
// floors: every floor number the building has (low to high, underground
// included) — see utils/navigation.js's floorsForBuilding.
// entranceShortcuts: [{ key, label, nodeId }], from
// utils/navigation.js's findKioskEntranceShortcuts — the flagged Building
// entrance and/or Campus entrance for this building, collapsed to one
// "Campus entrance" button when they're the same node. Shown above the
// floor list as direct-jump buttons, not floor picks.
// onBack: retreats to the building screen, clearing the building choice.
export default function KioskFloorScreen({ hidden, buildingLabel, floors, entranceShortcuts, onPick, onPickEntrance, onBack }) {
  return (
    <div
      className={"kiosk-building-screen kiosk-floor-screen" + (hidden ? " kiosk-building-screen-hidden" : "")}
      style={KIOSK_RAISED_STYLE}
      aria-hidden={hidden}
    >
      {/* Otherwise a pressed button here stays focused after the screen's
          own aria-hidden flips true on the next render (or, for Back, the
          building screen's does) — a focused element can't be hidden from
          assistive tech, so the browser refuses and logs a console
          warning about it. */}
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
      <h2 className="kiosk-building-title">
        Choose a starting point{buildingLabel ? ` in ${buildingLabel}` : ""}.
      </h2>
      <div className="kiosk-floor-list">
        {(entranceShortcuts || []).map((s) => (
          <button
            key={s.key}
            type="button"
            className="kiosk-building-btn kiosk-entrance-btn"
            onClick={(e) => {
              e.currentTarget.blur();
              onPickEntrance(s.nodeId);
            }}
          >
            {s.label}
          </button>
        ))}
        {floors.map((f) => (
          <button
            key={f}
            type="button"
            className="kiosk-building-btn"
            onClick={(e) => {
              e.currentTarget.blur();
              onPick(f);
            }}
          >
            {floorLabel(f)}
          </button>
        ))}
      </div>
    </div>
  );
}
