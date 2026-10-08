import { useEffect, useMemo, useRef, useState } from "react";
import { useSecurePhotoUrl } from "../hooks/useSecurePhotoUrl";
import { allBuildings, allCampuses, buildingLabel, campusForBuilding, floorLabel } from "../utils/constants";
import { DEFAULT_DIRECTORY_SETTINGS, listedRooms, roomsInBuilding } from "../utils/directorySettings";
import { buildingsForCampus } from "../utils/navigation";
import { useFlatPhotoUrl, CELL_PREVIEW, PANORAMA_THUMBNAIL_WIDTH } from "../hooks/useFlatPhotoUrl";
import { useDirectoryThumbnailPreload } from "../hooks/useDirectoryThumbnailPreload";
import { cellView, focusPosition, isPanorama, roomPhotos } from "../utils/roomPhotos";
import IconPlaceholder from "./IconPlaceholder";

// A room's row fades from the sidebar's own gray on the left into the room's
// photo on the right. The thumbnail is only requested once the row scrolls
// into view: a building can list over a hundred rooms, and most of them are
// never scrolled to.
function RoomRow({ room, isSelected, onSelect }) {
  const rowRef = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const row = rowRef.current;
    if (!row || seen) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setSeen(true);
    });
    observer.observe(row);
    return () => observer.disconnect();
  }, [seen]);

  // The first photo in the order an admin sorted them. A 360 photo is shown as
  // a flat-looking crop of itself, from a wider downscaled copy than a flat
  // photo needs since only part of it is used.
  const photo = roomPhotos(room.placard)[0] ?? null;
  const { url: loaded } = useSecurePhotoUrl(seen ? photo?.path : null, { thumbnail: isPanorama(photo) ? PANORAMA_THUMBNAIL_WIDTH : true, cached: true });
  const url = useFlatPhotoUrl(loaded, photo, CELL_PREVIEW, cellView(photo));

  return (
    <button
      ref={rowRef}
      type="button"
      className={"directory-room-row" + (isSelected ? " directory-row-selected" : "")}
      onClick={() => onSelect(room)}
    >
      <span className="directory-room-name">{room.roomName}</span>
      {url && (
        <img
          src={url}
          alt=""
          className="directory-room-photo"
          style={{ objectPosition: focusPosition(isPanorama(photo) ? null : photo) }}
        />
      )}
    </button>
  );
}

// "You are here" (with a pin), on the building the visitor is standing in
// and on that building's floor heading — as the mobile app's Directory.
function HereTag() {
  return (
    <span className="directory-here-tag">
      <IconPlaceholder name="location-pin" variant="white" className="directory-here-pin" />
      You are here
    </span>
  );
}

// A building's listed rooms under floor headings (Underground, Floor 1,
// Floor 2…), lowest floor first, each floor's rooms in the order they were
// already listed. `hereFloor` is the visitor's floor when this is the
// building they're in (null otherwise); that floor's heading says so, and
// it's shown even when none of its rooms are listed (the admin Directory
// page can trim them), so the visitor's floor is always marked.
function RoomsByFloor({ rooms, hereFloor, selectedRoomName, onSelect }) {
  const floors = useMemo(() => {
    const byFloor = new Map();
    rooms.forEach((r) => {
      const floor = Number(r.node.floor);
      if (!byFloor.has(floor)) byFloor.set(floor, []);
      byFloor.get(floor).push(r);
    });
    if (hereFloor !== null && hereFloor !== undefined && !byFloor.has(Number(hereFloor))) {
      byFloor.set(Number(hereFloor), []);
    }
    return [...byFloor.entries()].sort((a, b) => a[0] - b[0]);
  }, [rooms, hereFloor]);
  return floors.map(([floor, floorRooms]) => {
    const here = hereFloor !== null && hereFloor !== undefined && Number(hereFloor) === floor;
    return (
      <div className="directory-floor" key={floor}>
        <div className={"directory-floor-heading" + (here ? " directory-floor-heading-here" : "")}>
          <span>{floorLabel(floor)}</span>
          {here && <HereTag />}
        </div>
        {floorRooms.map((r) => (
          <RoomRow key={r.roomName} room={r} isSelected={r.roomName === selectedRoomName} onSelect={onSelect} />
        ))}
      </div>
    );
  });
}

function BuildingRow({ building, rooms: allRooms, settings, expanded, isHere, hereFloor, selectedRoomName, onToggle, onSelect }) {
  const rooms = useMemo(
    () => listedRooms(settings, building.id, roomsInBuilding(allRooms, building.id)),
    [allRooms, building.id, settings]
  );
  return (
    <div className="directory-building">
      <button
        type="button"
        className={"directory-building-row" + (isHere ? " directory-row-selected" : "")}
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span>{building.label} Building</span>
        {isHere && <HereTag />}
      </button>
      {expanded && (
        <div className="directory-room-list">
          {rooms.length === 0 && <p className="directory-empty-hint">No rooms found for this building yet.</p>}
          <RoomsByFloor
            rooms={rooms}
            hereFloor={isHere ? hereFloor : null}
            selectedRoomName={selectedRoomName}
            onSelect={onSelect}
          />
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
// affordance. Which campuses start expanded is an admin setting
// (`expandedBuildings`; Main Campus itself always starts open).
//
// `savedRooms` (the visitor's saved rooms, already resolved to directory
// rooms, see utils/savedRooms.js) adds a "Saved Directories" group above
// the campuses, collapsed to start, and only while at least one is saved.
//
// `settings` (see utils/directorySettings.js, edited on the admin Directory
// page) hides whole groups, campuses, buildings and individual rooms. It
// only trims what this accordion lists; search still finds every room.
//
// Inside a building its rooms sit under floor headings, and the building
// and floor the visitor is on (`currentBuildingId`, `currentFloor`) are
// tagged "You are here", as in the mobile app's Directory.
export default function DirectoryAccordion({
  rooms,
  savedRooms = [],
  settings = DEFAULT_DIRECTORY_SETTINGS,
  onSelect,
  selectedRoomName,
  currentBuildingId,
  currentFloor = null,
}) {
  const campuses = allCampuses().filter((c) => !settings.hiddenCampuses.includes(c.id));
  const mainCampus = campuses.find((c) => c.id === "main");
  const otherCampuses = campuses.filter((c) => c.id !== "main");
  const currentCampusId = currentBuildingId ? campusForBuilding(currentBuildingId) : null;

  // Main Campus always starts open; which buildings (and solo campuses, as
  // their one building) start expanded is the admin's setting. The settings
  // arrive after the first render, so the default is re-applied when it
  // changes; a visitor's own toggles stand until then.
  const defaultExpanded = settings.expandedBuildings.join("|");
  const [expandedCampuses, setExpandedCampuses] = useState(() => new Set(mainCampus ? [mainCampus.id] : []));
  const [expandedBuildings, setExpandedBuildings] = useState(() => new Set(settings.expandedBuildings));
  const [appliedDefault, setAppliedDefault] = useState(defaultExpanded);
  if (appliedDefault !== defaultExpanded) {
    setAppliedDefault(defaultExpanded);
    setExpandedBuildings(new Set(settings.expandedBuildings));
  }
  const [savedExpanded, setSavedExpanded] = useState(false);

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
  useDirectoryThumbnailPreload(rooms, buildings, settings);

  return (
    <div className="directory-accordion">
      {settings.showSaved && savedRooms.length > 0 && (
        <div className="directory-campus directory-saved">
          <button
            type="button"
            className="directory-campus-row"
            aria-expanded={savedExpanded}
            onClick={() => setSavedExpanded((v) => !v)}
          >
            <span>Saved Directories</span>
          </button>
          {savedExpanded && (
            <div className="directory-room-list">
              {savedRooms.map((r) => (
                <RoomRow key={r.roomName} room={r} isSelected={r.roomName === selectedRoomName} onSelect={onSelect} />
              ))}
            </div>
          )}
        </div>
      )}

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
              {buildingsForCampus(buildings, mainCampus.id, campusForBuilding)
                .filter((b) => !settings.hiddenBuildings.includes(b.id))
                .map((b) => (
                <BuildingRow
                  key={b.id}
                  building={b}
                  rooms={rooms}
                  settings={settings}
                  selectedRoomName={selectedRoomName}
                  isHere={b.id === currentBuildingId}
                  hereFloor={currentFloor}
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
        if (settings.hiddenBuildings.includes(soloBuildingId)) return null;
        const expanded = expandedBuildings.has(soloBuildingId);
        const isHere = campus.id === currentCampusId;
        return (
          <div className="directory-campus" key={campus.id}>
            <button
              type="button"
              className={"directory-campus-row" + (isHere ? " directory-row-selected" : "")}
              aria-expanded={expanded}
              onClick={() => toggleBuilding(soloBuildingId)}
            >
              <span>{campus.label}</span>
              {soloBuildingId === currentBuildingId && <HereTag />}
            </button>
            {expanded && (
              <div className="directory-room-list">
                <SoloCampusRooms
                  buildingId={soloBuildingId}
                  rooms={rooms}
                  settings={settings}
                  hereFloor={soloBuildingId === currentBuildingId ? currentFloor : null}
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

function SoloCampusRooms({ buildingId, rooms: allRooms, settings, hereFloor, selectedRoomName, onSelect }) {
  const rooms = useMemo(
    () => listedRooms(settings, buildingId, roomsInBuilding(allRooms, buildingId)),
    [allRooms, buildingId, settings]
  );
  return (
    <>
      {rooms.length === 0 && (
        <p className="directory-empty-hint">No rooms found for {buildingLabel(buildingId)} yet.</p>
      )}
      <RoomsByFloor rooms={rooms} hereFloor={hereFloor} selectedRoomName={selectedRoomName} onSelect={onSelect} />
    </>
  );
}
