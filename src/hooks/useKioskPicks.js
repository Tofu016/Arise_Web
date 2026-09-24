import { campusForBuilding } from "../utils/constants";
import { pickBuildingStart, pickFloorStart, kioskBuildingHasChoice, buildingsForCampus } from "../utils/navigation";

// Every "kiosk verb + Jump" composition off the mobile Building dialog and
// the Kiosk session's campus/building/floor screens — see
// hooks/useKioskSession.js for the stages themselves and utils/navigation.js
// for the pure picks (pickBuildingStart, pickFloorStart,
// kioskBuildingHasChoice, buildingsForCampus) these just sequence.
//
// `jump` is jumpToSearchResult from useNavigation — every pick here is a
// fresh start, never a walk. `land` is the kiosk-only variant that skips the
// flyover check: the campus/building/floor screens are choosing where the
// visitor starts, not moving them away from somewhere they'd actually stood,
// so their first pick shouldn't play a cross-campus flyover.
export function useKioskPicks({ nodes, byId, buildings, kiosk, setBuildingFilter, closeBuildingMenu, currentId, jump, land }) {
  // Building dialog, floor step: land on that floor's starting node.
  const handleMobileFloorPick = (buildingId, floor) => {
    const start = pickFloorStart(nodes, buildingId, floor);
    setBuildingFilter(buildingId);
    closeBuildingMenu();
    if (start && start.id !== currentId) jump(start.id);
  };

  // Building dialog, entrance shortcut: same as picking a floor, but lands
  // directly on that building's or campus's flagged entrance node instead
  // of a floor's default starting node.
  const handleMobileEntrancePick = (buildingId, nodeId) => {
    setBuildingFilter(buildingId);
    closeBuildingMenu();
    if (nodeId && nodeId !== currentId) jump(nodeId);
  };

  // Kiosk's campus screen: record the pick. Which campuses have more than
  // one building is data, not a fixed id — buildingsForCampus (backed by
  // campusForBuilding, itself reading buildings.campus_id) decides it fresh
  // each time, so any campus an admin groups multiple buildings under gets
  // a building screen the same way Main Campus does today. A solo-building
  // campus lands on its own floor screen instead — unless that building
  // doesn't actually offer a real choice, in which case there's nothing to
  // ask, so land immediately and skip straight past it.
  const handleKioskCampusPick = (campusId) => {
    const members = buildingsForCampus(buildings, campusId, campusForBuilding);
    if (members.length > 1) {
      kiosk.chooseCampus(campusId, null);
      return;
    }
    const soleBuildingId = members[0]?.id ?? campusId;
    kiosk.chooseCampus(campusId, soleBuildingId);
    setBuildingFilter(soleBuildingId);
    if (kioskBuildingHasChoice(nodes, soleBuildingId, campusForBuilding)) return;
    kiosk.chooseFloor();
    const start = pickBuildingStart(nodes, soleBuildingId);
    if (start) land(start.id);
  };

  // Kiosk's building screen (shown only for a multi-building campus): record
  // the pick and always move on to the floor screen — the only way to skip
  // it is the Campus Entrance entry on this same screen (see
  // handleKioskCampusEntrancePick).
  const handleKioskBuildingPick = (b) => {
    setBuildingFilter(b);
    kiosk.chooseBuilding(b);
  };

  // Kiosk's floor screen: land on that floor's starting node.
  const handleKioskFloorPick = (floor) => {
    const start = pickFloorStart(nodes, kiosk.building, floor);
    kiosk.chooseFloor();
    if (start) land(start.id);
  };

  // Same screen's entrance shortcuts (solo-building campuses only): land
  // directly on the flagged node.
  const handleKioskEntrancePick = (nodeId) => {
    kiosk.chooseFloor();
    if (nodeId) land(nodeId);
  };

  // Building screen's "Campus Entrance" entry (multi-building campuses
  // only): land directly on the flagged node, skipping the floor screen
  // entirely. The button that calls this is disabled whenever no entrance
  // node is flagged, so nodeId is always real here.
  const handleKioskCampusEntrancePick = (nodeId) => {
    if (!nodeId) return;
    kiosk.chooseBuilding(byId[nodeId].building);
    kiosk.chooseFloor();
    land(nodeId);
  };

  return {
    handleMobileFloorPick,
    handleMobileEntrancePick,
    handleKioskCampusPick,
    handleKioskBuildingPick,
    handleKioskFloorPick,
    handleKioskEntrancePick,
    handleKioskCampusEntrancePick,
  };
}
