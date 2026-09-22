import { useEffect, useMemo, useReducer } from "react";
import { initialKioskSession, kioskSessionReducer, kioskStage } from "../utils/kioskSession";

// Where the visitor is in the Kiosk session (see utils/kioskSession.js):
// { stage: "start" | "building" | "floor" | "exploring", building, awaitingStart,
//   start(), chooseBuilding(id), chooseFloor(), backToBuilding() }.
// `awaitingStart` is true while nobody is exploring yet, so "Done exploring?"
// would make no sense.
export function useKioskSession(compact) {
  const [state, dispatch] = useReducer(kioskSessionReducer, initialKioskSession);
  const verbs = useMemo(
    () => ({
      start: () => dispatch({ type: "start" }),
      chooseBuilding: (building) => dispatch({ type: "chooseBuilding", building }),
      chooseFloor: () => dispatch({ type: "chooseFloor" }),
      backToBuilding: () => dispatch({ type: "backToBuilding" }),
    }),
    []
  );
  const stage = kioskStage(state, compact);
  return { stage, building: state.building, awaitingStart: stage !== "exploring", ...verbs };
}

// On the Compact layout the panorama zooms only through its on-screen buttons.
// Stops the browser from zooming the whole page — header and bottom whitespace
// included — on a pinch: touch-action via the kiosk-mode class (see
// index.css), plus the pinch events that bypass it (Safari's gestures,
// ctrl+wheel from a trackpad pinch or a touchscreen driver that emulates one).
export function useKioskZoomLock(compact) {
  useEffect(() => {
    if (!compact) return;
    const root = document.documentElement;
    root.classList.add("kiosk-mode");
    const block = (e) => e.preventDefault();
    const blockCtrlWheel = (e) => {
      if (e.ctrlKey) e.preventDefault();
    };
    document.addEventListener("gesturestart", block);
    document.addEventListener("gesturechange", block);
    document.addEventListener("wheel", blockCtrlWheel, { passive: false });
    return () => {
      root.classList.remove("kiosk-mode");
      document.removeEventListener("gesturestart", block);
      document.removeEventListener("gesturechange", block);
      document.removeEventListener("wheel", blockCtrlWheel);
    };
  }, [compact]);
}
