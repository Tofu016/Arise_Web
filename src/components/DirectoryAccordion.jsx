import { useMemo, useState } from "react";
import { allBuildings, allCampuses, buildingLabel, campusForBuilding } from "../utils/constants";
import { buildingsForCampus } from "../utils/navigation";

// Every room/facility (from nodes' "Rooms served" lists, see
// buildSearchableRooms) in one building, in natural order ("Room 2" before
// "Room 10"). Rooms rather than nodes: a node is a panorama point, which
// means nothing to a visitor browsing for a destination.
function roomsInBuilding(rooms, buildingId) {
  return (rooms || [])
    .filter((r) => r.node.building === buildingId)
    .sort((a, b) => a.roomName.localeCompare(b.roomName, undefined, { numeric: true, sensitivity: "base" }));
}

function RoomRow({ room, isSelected, onSelect }) {
  return (
    <button
      type="button"
      className={"directory-room-row" + (isSelected ? " directory-row-selected" : "")}
      onClick={() => onSelect(room)}
    >
      <span>{room.roomName}</span>
    </button>
  );
}

function BuildingRow({ building, rooms: allRooms, expanded, isHere, selectedRoomName, onToggle, onSelect }) {
  const rooms = useMemo(() => roomsInBuilding(allRooms, building.id), [allRooms, building.id]);
  return (
    <div className="directory-building">
      <button
        type="button"
        className={"directory-building-row" + (isHere ? " directory-row-selected" : "")}
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span>{building.label} Building</span>
      </button>
      {expanded && (
        <div className="directory-room-list">
          {rooms.length === 0 && <p className="directory-empty-hint">No rooms found for this building yet.</p>}
          {rooms.map((r) => (
            <RoomRow key={r.roomName} room={r} isSelected={r.roomName === selectedRoomName} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

// The sidebar's "DIRECTORY" accordion: campus -> building -> room, matching
// the physical campus grouping in utils/constants.js (campusForBuilding).
// Main Campus (GD1/GD2/GD3, interconnected) gets the extra building tier;
// a solo-building campus (e.g. Digital Campus) has nothing to nest under
// itself, so its rooms sit directly under its own campus row instead.
//
// This is the sidebar's resting state now (see MainPage.jsx), not
// something opened from a hamburger, so there's no collapse-everything
// affordance — Main Campus starts expanded and stays that way; a visitor
// only ever expands further into it or into another campus.
export default function DirectoryAccordion({ rooms, onSelect, selectedRoomName, currentBuildingId }) {
  const campuses = allCampuses();
  const mainCampus = campuses.find((c) => c.id === "main");
  const otherCampuses = campuses.filter((c) => c.id !== "main");
  const currentCampusId = currentBuildingId ? campusForBuilding(currentBuildingId) : null;

  const [expandedCampuses, setExpandedCampuses] = useState(() => new Set(mainCampus ? [mainCampus.id] : []));
  const [expandedBuildings, setExpandedBuildings] = useState(() => new Set());

  const toggleCampus = (id) =>
    setExpandedCampuses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleBuilding = (id) =>
    setExpandedBuildings((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const buildings = allBuildings();

  return (
    <div className="directory-accordion">
      {mainCampus && (
        <div className="directory-campus">
          <button
            type="button"
            className={"directory-campus-row" + (mainCampus.id === currentCampusId ? " directory-row-selected" : "")}
            aria-expanded={expandedCampuses.has(mainCampus.id)}
            onClick={() => toggleCampus(mainCampus.id)}
          >
            <span>{mainCampus.label}</span>
          </button>
          {expandedCampuses.has(mainCampus.id) && (
            <div className="directory-building-list">
              {buildingsForCampus(buildings, mainCampus.id, campusForBuilding).map((b) => (
                <BuildingRow
                  key={b.id}
                  building={b}
                  rooms={rooms}
                  selectedRoomName={selectedRoomName}
                  isHere={b.id === currentBuildingId}
                  expanded={expandedBuildings.has(b.id)}
                  onToggle={() => toggleBuilding(b.id)}
                  onSelect={onSelect}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {otherCampuses.map((campus) => {
        // A solo campus is exactly one building (see allCampuses) — its
        // rooms render as this row's own children, skipping the building tier.
        const soloBuildingId = campus.buildingIds[0];
        const expanded = expandedCampuses.has(campus.id);
        const isHere = campus.id === currentCampusId;
        return (
          <div className="directory-campus" key={campus.id}>
            <button
              type="button"
              className={"directory-building-row" + (isHere ? " directory-row-selected" : "")}
              aria-expanded={expanded}
              onClick={() => toggleCampus(campus.id)}
            >
              <span>{campus.label}</span>
            </button>
            {expanded && (
              <div className="directory-room-list">
                <SoloCampusRooms
                  buildingId={soloBuildingId}
                  rooms={rooms}
                  selectedRoomName={selectedRoomName}
                  onSelect={onSelect}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SoloCampusRooms({ buildingId, rooms: allRooms, selectedRoomName, onSelect }) {
  const rooms = useMemo(() => roomsInBuilding(allRooms, buildingId), [allRooms, buildingId]);
  return (
    <>
      {rooms.length === 0 && (
        <p className="directory-empty-hint">No rooms found for {buildingLabel(buildingId)} yet.</p>
      )}
      {rooms.map((r) => (
        <RoomRow key={r.roomName} room={r} isSelected={r.roomName === selectedRoomName} onSelect={onSelect} />
      ))}
    </>
  );
}
