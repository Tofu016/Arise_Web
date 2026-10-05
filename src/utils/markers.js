import { normalize } from "./fuzzy";
import { namesOfKind } from "./search";

// What can be wrong with a marker as authored, found without opening the
// panorama. Each problem is a short code the Marker Management page words
// for the admin:
//   blank-label       a non-elevator marker with no label, so it shows an empty pill
//   unmatched-room    a "room" marker whose label matches none of its node's Rooms
//                     served, so the public viewer's room panel cannot be opened
//   duplicate         the same type and label twice on one node
//   no-elevator       an elevator landing pointing at a missing Elevator record
//   floor-not-served  an elevator landing on a floor its Elevator does not stop at
//   no-details        a facility with no saved details (or an empty record), so its
//                     panel reads "No information."
//   exit-no-landing   an emergency exit marker with no landings on a node that is not
//                     ticked as a destination, so it leads nowhere
//   origin            yaw and pitch both 0, the placeholder a marker keeps until placed
export const MARKER_PROBLEMS = {
  "blank-label": "No label.",
  "unmatched-room": "Label matches none of this node's Rooms served.",
  duplicate: "Same type and label appears more than once on this node.",
  "no-elevator": "Points at an Elevator that no longer exists.",
  "floor-not-served": "Its Elevator does not stop at this floor.",
  "no-details": "No saved details yet, so its panel reads \"No information.\" Add them in the Room and Facility Editor.",
  "exit-no-landing":
    "Emergency exit with no landings, and its node is not an Emergency Exit Destination Point. Add landings, or tick the node if this door leads outside.",
  origin: "Still at the default position (yaw 0, pitch 0).",
};

// Whether a details record says anything a visitor would see (RoomCard's rule).
const hasDetails = (p) => !!(p && (p.roomDescription || p.link || p.contactNumber || p.department || p.photo));

// The names whose saved details should be deleted with the markers that carried
// them. `before` and `after` are the node lists around one change; a marker
// counts as removed when its id is gone from `after` (a relabelled marker keeps
// its id, so renaming is not removal), and a name still used by any room or
// facility afterwards is kept.
export function orphanedFacilityNames(before, after) {
  const afterIds = new Set(after.flatMap((n) => (n.markers || []).map((m) => m.id)));
  const stillUsed = new Set(after.flatMap((n) => [...namesOfKind(n, "room"), ...namesOfKind(n, "facility")]).map(normalize));
  const out = new Map();
  for (const n of before) {
    for (const m of n.markers || []) {
      const name = (m.label || "").trim();
      if (m.type !== "facility" || !name || afterIds.has(m.id) || stillUsed.has(normalize(name))) continue;
      out.set(normalize(name), name);
    }
  }
  return [...out.values()];
}

// Every marker across every node, flattened to one row each, with its node's
// place data and any problems attached. `elevators` is the Elevators list;
// `getForRoom` looks a name's saved details up (usePlacardDialogs), and
// without it facilities are not checked for details.
export function inventoryMarkers(nodes, elevators = [], getForRoom = null) {
  const elevatorById = new Map(elevators.map((e) => [e.id, e]));
  const rows = [];
  for (const node of nodes) {
    const markers = node.markers || [];
    const roomKeys = new Set((node.rooms || []).map(normalize));
    const seen = new Map();
    for (const m of markers) {
      const key = `${m.type}|${normalize(m.label)}`;
      seen.set(key, (seen.get(key) || 0) + 1);
    }
    for (const m of markers) {
      const problems = [];
      const isElevator = m.type === "elevator";
      if (!isElevator && !normalize(m.label)) problems.push("blank-label");
      if (m.type === "room" && normalize(m.label) && !roomKeys.has(normalize(m.label))) problems.push("unmatched-room");
      if (normalize(m.label) && seen.get(`${m.type}|${normalize(m.label)}`) > 1) problems.push("duplicate");
      if (isElevator) {
        const elevator = m.elevatorId ? elevatorById.get(m.elevatorId) : null;
        if (!elevator) problems.push("no-elevator");
        else if (!elevator.accessibleFloors.includes(Number(node.floor))) problems.push("floor-not-served");
      }
      if (m.type === "emergency_exit" && (m.landings || []).length === 0 && !node.isEmergencyDestination) {
        problems.push("exit-no-landing");
      }
      if (m.type === "facility" && getForRoom && normalize(m.label) && !hasDetails(getForRoom(m.label))) problems.push("no-details");
      if (Number(m.yaw) === 0 && Number(m.pitch) === 0) problems.push("origin");
      rows.push({
        ...m,
        // An elevator marker's label is the Elevator record's, joined at read time.
        label: isElevator ? m.label || elevatorById.get(m.elevatorId)?.label || "" : m.label,
        nodeId: node.id,
        nodeName: node.name,
        building: node.building,
        floor: Number(node.floor),
        problems,
      });
    }
  }
  return rows;
}
