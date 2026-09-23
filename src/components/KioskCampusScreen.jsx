import { BUILDINGS } from "../utils/constants";
import { KIOSK_RAISED_STYLE } from "../utils/kioskLayout";

const MAIN_CAMPUS_BUILT_IN_IDS = BUILDINGS.map((b) => b.id);

// The kiosk's very first choice after the start screen, covering the whole
// viewport like it. Main Campus (GD1/GD2/GD3, physically interconnected)
// represents all three built-in buildings as one entry; every other
// building (today just Digital Campus, later any admin-added one) is its
// own single-building campus and gets its own entry — see
// utils/constants.js's campusForBuilding. Picking Main Campus goes on to the
// building screen; picking anything else skips straight to that building's
// floor screen, since there's nothing else to choose between. Stays mounted
// so the fade can play and CSS makes it inert afterwards.
//
// buildings: [{ id, label }]; available: ids that have nodes to land on.
export default function KioskCampusScreen({ hidden, buildings, available, onPick }) {
  const hasMainCampus = buildings.some((b) => MAIN_CAMPUS_BUILT_IN_IDS.includes(b.id));
  const otherCampuses = buildings.filter((b) => !MAIN_CAMPUS_BUILT_IN_IDS.includes(b.id));
  const mainCampusAvailable = MAIN_CAMPUS_BUILT_IN_IDS.some((id) => available.has(id));

  const renderButton = (key, label, isAvailable, onClick) => (
    <button
      key={key}
      type="button"
      className="kiosk-building-btn"
      disabled={!isAvailable}
      onClick={(e) => {
        // Otherwise this button stays focused after the screen's own
        // aria-hidden flips true on the next render — a focused element
        // can't be hidden from assistive tech, so the browser refuses and
        // logs a console warning about it.
        e.currentTarget.blur();
        onClick();
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      className={"kiosk-building-screen" + (hidden ? " kiosk-building-screen-hidden" : "")}
      style={KIOSK_RAISED_STYLE}
      aria-hidden={hidden}
    >
      <h2 className="kiosk-building-title">Select a Campus</h2>
      <div className="kiosk-building-columns">
        <div className="kiosk-building-column">
          {hasMainCampus && renderButton("main", "Main Campus", mainCampusAvailable, () => onPick("main"))}
        </div>
        <div className="kiosk-building-column">
          {otherCampuses.map((b) => renderButton(b.id, b.label, available.has(b.id), () => onPick(b.id)))}
        </div>
      </div>
    </div>
  );
}
