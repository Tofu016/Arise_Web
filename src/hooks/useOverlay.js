import { useEffect, useMemo, useReducer } from "react";
import { initialOverlay, overlayReducer } from "../utils/overlay";

// The visitor view's overlay state (see utils/overlay.js for what it holds),
// as the state fields plus stable verbs. Owns the Escape key: it collapses
// the dock and its panel. On desktop the panel's backdrop is purely visual —
// it doesn't intercept clicks, so the panorama stays draggable — which makes
// Escape the keyboard way out.
export function useOverlay() {
  const [state, dispatch] = useReducer(overlayReducer, initialOverlay);

  const verbs = useMemo(() => {
    const send = (type) => () => dispatch({ type });
    return {
      showPanel: (mode) => dispatch({ type: "showPanel", mode }),
      closePanel: send("closePanel"),
      toggleMenu: send("toggleMenu"),
      blurSearch: send("blurSearch"),
      openDock: send("openDock"),
      closeDock: send("closeDock"),
      dismiss: send("dismiss"),
      openFromDock: (target) => dispatch({ type: "openFromDock", target }),
      openFeedback: send("openFeedback"),
      closeFeedback: send("closeFeedback"),
      openEndSessionThanks: send("openEndSessionThanks"),
      closeEndSessionThanks: send("closeEndSessionThanks"),
      openRoom360: send("openRoom360"),
      closeRoom360: send("closeRoom360"),
      openHelp: send("openHelp"),
      closeHelp: send("closeHelp"),
      closeBuildingMenu: send("closeBuildingMenu"),
      setFloorPick: (building) => dispatch({ type: "setFloorPick", building }),
      setWalkDialog: (open) => dispatch({ type: "setWalkDialog", open }),
      openDirections: send("openDirections"),
      closeDirections: send("closeDirections"),
      walkStarted: send("walkStarted"),
      closeRoomCard: send("closeRoomCard"),
      moved: (move) => dispatch({ type: "moved", move }),
      heldForFlyover: ({ closePanel = false } = {}) => dispatch({ type: "heldForFlyover", closePanel }),
    };
  }, []);

  const escapable = !!state.panel || state.dock;
  useEffect(() => {
    if (!escapable) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") verbs.dismiss();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [escapable, verbs]);

  return { ...state, ...verbs };
}
