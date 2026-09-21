// The Kiosk session: the flow a visitor goes through on the Compact layout —
// the attract screen until it's tapped, then the building screen until a
// building is picked, then exploring. Desktop skips it entirely. Pure: the
// hook in hooks/useKioskSession.js wraps it. (A session ends by remounting the
// visitor view, which starts a fresh one.)

export const initialKioskSession = { started: false, buildingChosen: false };

export function kioskSessionReducer(state, action) {
  switch (action.type) {
    case "start":
      return { ...state, started: true };
    case "chooseBuilding":
      return { ...state, buildingChosen: true };
    default:
      return state;
  }
}

// "start" | "building" | "exploring"
export function kioskStage(state, compact) {
  if (!compact) return "exploring";
  if (!state.started) return "start";
  return state.buildingChosen ? "exploring" : "building";
}
