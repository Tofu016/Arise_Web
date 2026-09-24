import { campusForBuilding } from "../utils/constants";
import { KIOSK_RAISED_STYLE } from "../utils/kioskLayout";

// The kiosk's very first choice after the start screen, covering the whole
// viewport like it. Buildings are grouped by resolved campus (see
// utils/constants.js's campusForBuilding, a data-driven lookup over
// buildings.campus_id) — Main Campus (GD1/GD2/GD3, physically
// interconnected) is just today's one example of a multi-building group,
// not a special case in this component. Picking a campus with more than one
// building goes on to the building screen (see useKioskPicks's
// handleKioskCampusPick, which decides that dynamically the same way);
// picking a solo-building campus skips straight to that building's floor
// screen. Stays mounted so the fade can play and CSS makes it inert
// afterwards.
//
// buildings: [{ id, label }]; available: ids that have nodes to land on.
export default function KioskCampusScreen({ hidden, buildings, available, onPick }) {
  // Group by resolved campus, not by building — a campus with more than one
  // building (Main Campus today, any admin-grouped campus tomorrow) gets one
  // entry for the whole group, not one per member building. There's no
  // separate "campus name" field in the data model, so a multi-building
  // group's label is its members' labels joined; a solo campus just uses
  // its one building's own label.
  const campusGroups = new Map(); // campusId -> { id, label, buildingIds }
  for (const b of buildings) {
    const campusId = campusForBuilding(b.id);
    const group = campusGroups.get(campusId);
    if (group) {
      group.buildingIds.push(b.id);
      group.labels.push(b.label);
    } else {
      campusGroups.set(campusId, { id: campusId, labels: [b.label], buildingIds: [b.id] });
    }
  }
  const mainGroup = campusGroups.get("main");
  const otherGroups = [...campusGroups.values()].filter((g) => g.id !== "main");

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
          {mainGroup &&
            renderButton(
              "main",
              "Main Campus",
              mainGroup.buildingIds.some((id) => available.has(id)),
              () => onPick("main")
            )}
        </div>
        <div className="kiosk-building-column">
          {otherGroups.map((g) =>
            renderButton(
              g.id,
              g.labels.join(" / "),
              g.buildingIds.some((id) => available.has(id)),
              () => onPick(g.id)
            )
          )}
        </div>
      </div>
    </div>
  );
}
