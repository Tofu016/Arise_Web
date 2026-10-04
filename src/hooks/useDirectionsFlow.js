import { useMemo } from "react";
import { useDirections, useAutoWalk } from "./useDirections";
import * as route from "../utils/directionsRoute";
import { findNearestExit } from "../utils/pathfinding";
import { searchCampus } from "../utils/search";
import { speak } from "../utils/tts";
import { floorLabel } from "../utils/constants";

// The Directions flow ("just like Street View"): the from/to panel and the
// Route it computes, followed one stop at a time. Wraps the pure transitions
// in utils/directionsRoute.js and owns the sequences that cross into other
// modules, so each has one place to be right:
//   open / openTo   replace whatever the panel was showing, clear the search box
//   startWalking    jump to the route's first stop, restart the route, then reopen
//                   the panel (the jump closed it) collapsed to the walk bar (kiosk)
//   get             compute the route and start the walk in one go — no second press
//   walkToNext      walk to the next stop, facing the way the hotspot points
//
// Collaborators are injected, so this knows nothing about navigation or the
// overlay beyond these verbs:
//   moves    { jump(id), walk(id, { yaw, defaultYaw?, defaultPitch? }) }
//   overlay  { openDirections(), closeDirections(), walkStarted() }
//   clearSearch()
//
// Returns { directions, progress, suggestions, ...verbs }:
//   directions    the state (null when closed) — see utils/directionsRoute.js
//   progress      { arrived, nextStopId, nextStopName, turnInstruction, walkStarted }
//   suggestions   { rooms, places } matching the From/To field being edited: rooms
//                 first, places second, no duplicates, like the main search bar
export function useDirectionsFlow({
  nodes,
  current,
  currentId,
  byId,
  entryYaw,
  hotspots,
  searchableRooms,
  moves,
  overlay,
  clearSearch,
}) {
  const [directions, setDirections] = useDirections(nodes, currentId);

  const progress = {
    ...route.routeProgress(directions, { byId, hotspots, entryYaw, nodes }),
    walkStarted: route.hasStartedWalking(directions, currentId),
  };

  const query = route.activeQuery(directions);
  const editingField = directions?.editingField;
  const suggestions = useMemo(() => {
    if (!editingField || !query.trim()) return { rooms: [], places: [] };
    const { roomResults, placeResults } = searchCampus(query, nodes, searchableRooms);
    return { rooms: roomResults, places: placeResults };
  }, [editingField, query, nodes, searchableRooms]);

  const openTo = (node) => {
    setDirections(route.openDirectionsTo(current, node));
    overlay.openDirections();
    clearSearch();
  };

  // Kiosk origin choice, "Current Location" / "Kiosk Location": route from a
  // known node straight away, no second press. A same-node pick has no route
  // to walk, so it says so in the panel instead of "arriving" instantly.
  const routeFrom = (fromNode, toNode) => {
    if (!fromNode || !nodes) return;
    const opened = route.openDirectionsBetween(fromNode, toNode);
    overlay.openDirections();
    clearSearch();
    if (fromNode.id === toNode.id) {
      setDirections({ ...opened, error: "You are already at this location." });
      return;
    }
    const next = route.getDirections(opened, nodes, searchableRooms);
    setDirections(next);
    if (next.path) startWalking(next);
  };

  // Kiosk origin choice, "Custom Location": the panel opens with the
  // destination filled in and the starting point blank, awaiting a pick.
  const openToWithBlankOrigin = (node) => {
    setDirections(route.openDirectionsToWithBlankOrigin(node));
    overlay.openDirections();
    clearSearch();
  };

  const open = () => {
    if (!current || !nodes) return;
    setDirections(route.openDirections(current));
    overlay.openDirections();
    clearSearch();
  };

  const close = () => {
    setDirections(null);
    overlay.closeDirections();
  };

  // "Nearest Exit": finds the closest transitionExit node by stairs (see
  // findNearestExit) and routes straight to it, no From/To typing needed —
  // one tap in an emergency. Reuses the same panel/state as a normal
  // route once the destination is resolved, so progress, auto-walk, and
  // arrival all work the same way as any other directions flow.
  const openNearestExit = () => {
    if (!current || !nodes) return;
    const exitId = findNearestExit(nodes, currentId);
    if (!exitId) {
      setDirections({ ...route.openDirections(current), error: "No emergency exit reachable by stairs from here." });
      overlay.openDirections();
      clearSearch();
      return;
    }
    const exitNode = nodes.find((n) => n.id === exitId);
    const opened = route.openDirectionsTo(current, exitNode);
    const next = route.getEmergencyDirections(opened, nodes);
    setDirections(next);
    overlay.openDirections();
    clearSearch();
    if (next.path) startWalking(next);
  };

  const startWalking = (d = directions) => {
    if (!d?.path) return;
    moves.jump(d.path[0]);
    setDirections(route.restartRoute);
    overlay.walkStarted();
    if (d.toQuery) speak(`Walking to: ${d.toQuery}`);
  };

  const get = () => {
    const next = route.getDirections(directions, nodes, searchableRooms);
    setDirections(next);
    // A pending stairs/elevator choice holds off the auto-walk-on-get
    // behavior — the panel asks first (see the "pendingModeChoice" render
    // branch); chooseMode below starts the walk once one is picked.
    if (next.path) startWalking(next);
  };

  const chooseMode = (mode) => {
    const next = route.chooseTransportMode(directions, mode);
    setDirections(next);
    if (next.path) startWalking(next);
  };

  // An elevator step rides straight to the route's floor: the panel's
  // button (and auto-walk) already know the floor, so there's no floor
  // picker in the way. The picker only appears when the visitor taps the
  // landing marker itself (see MainPage's handleElevatorMarkerClick).
  const walkToNext = () => {
    const step = route.nextStep(directions, hotspots, nodes);
    if (!step) return;
    if (step.kind === "elevator") speak(`Taking the elevator to ${floorLabel(step.ride.toFloor)}`);
    moves.walk(step.id, { yaw: step.yaw, defaultYaw: step.defaultYaw, defaultPitch: step.defaultPitch });
  };
  useAutoWalk(directions, setDirections, walkToNext);

  return {
    directions,
    progress,
    suggestions,
    open,
    openTo,
    routeFrom,
    openToWithBlankOrigin,
    openNearestExit,
    close,
    get,
    chooseMode,
    startWalking,
    walkToNext,
    toggleAutoWalk: () => setDirections(route.toggleAutoWalk),
    editField: (field, value) => setDirections((d) => route.editField(d, field, value)),
    focusField: (field) => setDirections((d) => route.focusField(d, field)),
    pickNode: (field, node) => setDirections((d) => route.pickNodeField(d, field, node)),
    pickRoom: (field, room) => setDirections((d) => route.pickRoomField(d, field, room)),
  };
}
