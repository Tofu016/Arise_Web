import { useMemo, useState } from "react";
import { allBuildings, allCampuses, buildingLabel, campusForBuilding } from "../utils/constants";
import { buildingsForCampus } from "../utils/navigation";

// How many room/facility entries to surface per building in the accordion.
// There's no curated "directory listing" data yet (see Room Editor — only
// rooms an admin has gone through that for have detail records, and most
// nodes don't), so this picks straight from that building's own nodes
// instead of leaving the accordion empty. Picked once per session (see
// shuffledPicks below), not on every render.
const ROOMS_PER_BUILDING = 5;

// Deterministic-feeling but different every session: shuffles once when
// `nodes`/`buildingId` first loads and keeps that same order for the rest
// of the visit, rather than re-rolling on every render (which would make
// items jump around under the visitor's cursor). This intentionally does
// NOT depend on currentId, so pressing an entry (which changes currentId
// via navigation) never triggers a re-shuffle.
function shuffledPicks(nodes, buildingId) {
  const candidates = (nodes || []).filter((n) => n.building === buildingId);
  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return { candidates, picks: shuffled.slice(0, ROOMS_PER_BUILDING) };
}

// The visitor's actual current node is always forced into its building's
// list (swapped in over the last pick if the shuffle didn't already
// include it), without re-shuffling the rest of the order.
function withCurrentForced(picks, candidates, currentId) {
  if (!picks.some((n) => n.id === currentId)) {
    const current = candidates.find((n) => n.id === currentId);
    if (current) return [...picks.slice(0, -1), current];
  }
  return picks;
}

function RoomRow({ node, isHere, onSelect }) {
  return (
    <button
      type="button"
      className={"directory-room-row" + (isHere ? " directory-row-selected" : "")}
      onClick={() => onSelect(node.id)}
    >
      <span>{node.name}</span>
    </button>
  );
}

function BuildingRow({ building, nodes, expanded, isHere, currentId, onToggle, onSelect }) {
  const { candidates, picks } = useMemo(() => shuffledPicks(nodes, building.id), [nodes, building.id]);
  const rooms = useMemo(() => withCurrentForced(picks, candidates, currentId), [picks, candidates, currentId]);
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
          {rooms.map((n) => (
            <RoomRow key={n.id} node={n} isHere={n.id === currentId} onSelect={onSelect} />
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
export default function DirectoryAccordion({ nodes, onSelect, currentId, currentBuildingId }) {
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
                  nodes={nodes}
                  currentId={currentId}
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
                <SoloCampusRooms buildingId={soloBuildingId} nodes={nodes} currentId={currentId} onSelect={onSelect} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SoloCampusRooms({ buildingId, nodes, currentId, onSelect }) {
  const { candidates, picks } = useMemo(() => shuffledPicks(nodes, buildingId), [nodes, buildingId]);
  const rooms = useMemo(() => withCurrentForced(picks, candidates, currentId), [picks, candidates, currentId]);
  return (
    <>
      {rooms.length === 0 && (
        <p className="directory-empty-hint">No rooms found for {buildingLabel(buildingId)} yet.</p>
      )}
      {rooms.map((n) => (
        <RoomRow key={n.id} node={n} isHere={n.id === currentId} onSelect={onSelect} />
      ))}
    </>
  );
}
