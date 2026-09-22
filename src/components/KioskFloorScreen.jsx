import { floorLabel } from "../utils/constants";

// The kiosk's floor selection screen, shown after a building is picked and
// covering the whole viewport like the screens before it. MainPage never
// puts the session in this stage for a building with only one floor to
// land on, so it's skipped without ever appearing in that case — see
// utils/kioskSession.js.
//
// floors: every floor number the building has (low to high, underground
// included) — see utils/navigation.js's floorsForBuilding.
export default function KioskFloorScreen({ hidden, buildingLabel, floors, onPick }) {
  return (
    <div
      className={"kiosk-building-screen" + (hidden ? " kiosk-building-screen-hidden" : "")}
      aria-hidden={hidden}
    >
      <h2 className="kiosk-building-title">
        Choose a floor{buildingLabel ? ` — ${buildingLabel}` : ""}
      </h2>
      <div className="kiosk-floor-list">
        {floors.map((f) => (
          <button key={f} type="button" className="kiosk-building-btn" onClick={() => onPick(f)}>
            {floorLabel(f)}
          </button>
        ))}
      </div>
    </div>
  );
}
