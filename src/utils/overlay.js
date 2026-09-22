// What the visitor view has on screen over the panorama. Pure: the hook in
// hooks/useOverlay.js is a thin useReducer wrapper around this.
//
// One exclusive panel slot (Maps-style: only one of menu/search/room/
// directions/account at a time) plus overlays that stand on their own and can
// coexist with it: the mobile dock, the feedback panel, a room's 360° view
// and the building dialog.

export const initialOverlay = {
  panel: null, // null | "menu" | "search" | "room" | "directions" | "account"
  dock: false, // mobile/kiosk: the radial menu is expanded
  feedback: false,
  room360: false,
  buildingMenu: false,
  floorPick: null, // building whose floor list is expanded in the building dialog
  walkDialog: true, // kiosk: big directions dialog (true) vs compact walk bar (false)
  roomCard: null, // the room whose card the "room" panel shows; kept while its 360° view is open
  help: false, // the "how to use this tour" tips modal, reachable from the menu/dock at any time
};

export function overlayReducer(state, action) {
  switch (action.type) {
    case "showPanel":
      return { ...state, panel: action.mode };
    case "closePanel":
      return { ...state, panel: null };
    case "toggleMenu":
      return { ...state, panel: state.panel === "menu" ? null : "menu" };
    case "blurSearch":
      return state.panel === "search" ? { ...state, panel: null } : state;
    case "openDock":
      return { ...state, dock: true };
    case "closeDock":
      return { ...state, dock: false };
    case "dismiss": // the FAB, the backdrop, Escape: collapse the dock and its panel
      return { ...state, panel: null, dock: false };
    case "openFromDock": // a radial item: collapse the dock, then open its target
      return openTarget({ ...state, dock: false }, action.target);
    case "openFeedback":
      return { ...state, feedback: true };
    case "closeFeedback":
      return { ...state, feedback: false };
    case "openRoom360":
      return { ...state, room360: true };
    case "closeRoom360":
      return { ...state, room360: false };
    case "openHelp":
      return { ...state, dock: false, help: true };
    case "closeHelp":
      return { ...state, help: false };
    case "closeBuildingMenu":
      return { ...state, buildingMenu: false };
    case "setFloorPick":
      return { ...state, floorPick: action.building };
    case "setWalkDialog":
      return { ...state, walkDialog: action.open };
    // Directions replace whatever the panel was showing, and start on the big dialog.
    case "openDirections":
      return { ...state, dock: false, walkDialog: true, panel: "directions" };
    case "closeDirections":
      return { ...state, walkDialog: true, panel: null };
    case "walkStarted": // the route's first jump closed the panel; reopen it collapsed to the walk bar
      return { ...state, walkDialog: false, panel: "directions" };
    case "closeRoomCard":
      return { ...state, roomCard: null, panel: null };
    // A move that happened: back and walk leave the panel as it was; a jump
    // opens the room card it came from, or closes the panel.
    case "moved": {
      const { move } = action;
      const next = { ...state, dock: false };
      if (move.type === "back" || move.type === "walk") return next;
      return move.room ? { ...next, roomCard: move.room, panel: "room" } : { ...next, panel: null };
    }
    // A move held back behind a flyover: the dock closes now; a jump also
    // dismisses the panel even though the hop itself is deferred.
    case "heldForFlyover":
      return { ...state, dock: false, panel: action.closePanel ? null : state.panel };
    default:
      return state;
  }
}

function openTarget(state, target) {
  switch (target) {
    case "search":
    case "account":
      return { ...state, panel: target };
    case "feedback":
      return { ...state, feedback: true };
    case "building":
      return { ...state, floorPick: null, buildingMenu: true };
    case "help":
      return { ...state, help: true };
    default:
      return state;
  }
}

// Whether something is up that means the visitor is busy, not idle — the
// idle prompt must not appear over it. Off while the kiosk's start/building
// screens are up too (`awaitingStart`): nobody is exploring yet. The building
// dialog isn't counted; it has always been left out here.
export function blocksIdle(state, { flyover, awaitingStart }) {
  return (
    !!state.panel || state.dock || state.feedback || state.room360 || state.help || !!flyover || !!awaitingStart
  );
}

// What the current overlays mean for the rest of the screen.
//   walkBarShown     kiosk: the route is being walked and the big directions dialog has stepped aside
//   kioskDialogOpen  a kiosk dialog owns the top of the panorama (node name and menu button step aside)
//   coversPanorama   something pops up over the panorama, so hotspot previews hide; the walk bar
//                    is small and leaves the panorama usable, so it doesn't count. The idle
//                    prompt is not included — the caller adds it.
export function coverage(state, { compact, directions, arrived, walkStarted, flyover }) {
  const walkBarShown = !!compact && state.panel === "directions" && walkStarted && !arrived && !state.walkDialog;
  const kioskDialogOpen =
    !!compact &&
    (state.panel === "search" ||
      (state.panel === "directions" && !!directions && !arrived && !walkBarShown) ||
      state.feedback);
  const coversPanorama =
    (!!state.panel && !walkBarShown) ||
    state.dock ||
    state.feedback ||
    state.buildingMenu ||
    state.room360 ||
    state.help ||
    !!flyover;
  return { walkBarShown, kioskDialogOpen, coversPanorama };
}
