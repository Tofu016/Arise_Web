// The Kiosk session: the flow a visitor goes through on the Compact layout —
// the attract screen until it's tapped, then the building screen until a
// building is picked, then the floor screen until a floor is picked, then
// exploring. Desktop skips it entirely. Pure: the hook in
// hooks/useKioskSession.js wraps it. (A session ends by remounting the
// visitor view, which starts a fresh one.)
//
// The floor screen is a real stage in this state machine, but MainPage can
// (and does, for a building with only one floor and no Building/Campus
// entrance shortcuts to offer either) dispatch "chooseFloor" in the very
// same handler as "chooseBuilding" — the visitor then never actually sees
// it, since both land before the next render.

export const initialKioskSession = { started: false, building: null, floorChosen: false };

export function kioskSessionReducer(state, action) {
  switch (action.type) {
    case "start":
      return { ...state, started: true };
    case "chooseBuilding":
      return { ...state, building: action.building, floorChosen: false };
    case "chooseFloor":
      return { ...state, floorChosen: true };
    case "backToBuilding":
      return { ...state, building: null };
    default:
      return state;
  }
}

// "start" | "building" | "floor" | "exploring"
export function kioskStage(state, compact) {
  if (!compact) return "exploring";
  if (!state.started) return "start";
  if (!state.building) return "building";
  return state.floorChosen ? "exploring" : "floor";
}
