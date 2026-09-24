// The Kiosk session: the flow a visitor goes through on the Compact layout —
// the attract screen until it's tapped, then the campus screen, then (only
// when the picked campus has more than one building — see
// utils/navigation.js's buildingsForCampus) the building screen, then the
// floor screen, then exploring. A solo-building campus sets `building`
// immediately when it's picked and skips the building screen entirely; this
// reducer doesn't decide which case it is itself — "chooseCampus" is always
// told the building explicitly (null for "show the building screen"), by
// whichever caller already knows the campus's membership (see
// hooks/useKioskPicks.js's handleKioskCampusPick). Desktop skips the whole
// thing. Pure: the hook in hooks/useKioskSession.js wraps it. (A session
// ends by remounting the visitor view, which starts a fresh one.)
//
// The floor screen is a real stage in this state machine, but MainPage can
// (and does) dispatch "chooseFloor" in the very same handler as
// "chooseCampus"/"chooseBuilding" in two cases: a single-building campus
// with only one floor and no entrance shortcut to offer either, or Main
// Campus's own Campus Entrance entry on the building screen. Either way the
// visitor never actually sees the floor screen, since both land before the
// next render.

export const initialKioskSession = { started: false, campus: null, building: null, floorChosen: false };

export function kioskSessionReducer(state, action) {
  switch (action.type) {
    case "start":
      return { ...state, started: true };
    case "chooseCampus":
      return {
        ...state,
        campus: action.campus,
        building: action.building ?? null,
        floorChosen: false,
      };
    case "chooseBuilding":
      return { ...state, building: action.building, floorChosen: false };
    case "chooseFloor":
      return { ...state, floorChosen: true };
    case "backToCampus":
      return { ...state, campus: null, building: null, floorChosen: false };
    case "backToBuilding":
      return { ...state, building: null, floorChosen: false };
    default:
      return state;
  }
}

// "start" | "campus" | "building" | "floor" | "exploring"
export function kioskStage(state, compact) {
  if (!compact) return "exploring";
  if (!state.started) return "start";
  if (!state.campus) return "campus";
  if (!state.building) return "building";
  return state.floorChosen ? "exploring" : "floor";
}
