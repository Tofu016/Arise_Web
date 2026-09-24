import { floorLabel } from "../utils/constants";
import { KIOSK_RAISED_STYLE } from "../utils/kioskLayout";

// The kiosk's starting-point selection screen, shown after a building is
// picked on a multi-building campus, or a solo-building campus is picked
// directly (e.g. Digital Campus — see KioskCampusScreen), and covering the
// whole viewport like the screens before it. Always shown for a
// multi-building campus's building pick (the only way to skip it is the
// building screen's own Campus Entrance entry); for a solo-building campus,
// MainPage skips it when that building has only one floor and no entrance
// shortcut to land on instead — see utils/kioskSession.js.
//
// floors: every floor number the building has (low to high, underground
// included) — see utils/navigation.js's floorsForBuilding.
// entranceShortcuts: [{ key, label, nodeId }], from
// utils/navigation.js's findKioskEntranceShortcuts — only passed for a
// solo-building campus, which has no earlier building screen to offer its
// Campus entrance on instead. Shown above the floor list as direct-jump
// buttons, not floor picks.
// onBack: retreats to the building screen (multi-building campus) or the
// campus screen (a solo-building campus), clearing the building choice
// either way.
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
        Select a Starting Point{buildingLabel ? ` in ${buildingLabel}` : ""}
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
