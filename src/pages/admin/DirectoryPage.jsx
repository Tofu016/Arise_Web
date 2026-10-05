import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { usePlacardDialogs } from "../../hooks/usePlacardDialogs";
import { useDirectorySettings } from "../../hooks/useDirectorySettings";
import { NODE_TYPES, allBuildings, allCampuses, buildingLabel, campusForBuilding, floorLabel, floorsForBuilding } from "../../utils/constants";
import { buildSearchableRooms, rankRoomMatches } from "../../utils/search";
import { buildingsForCampus } from "../../utils/navigation";
import {
  addRooms,
  clearBuilding,
  entryFor,
  isRoomListed,
  removeRooms,
  roomsInBuilding,
  sameDirectorySettings,
  setIncoming,
  toggleInList,
} from "../../utils/directorySettings";
import IconPlaceholder from "../../components/IconPlaceholder";

const DEFAULT_FILTERS = { search: "", building: "all", floor: "all", type: "all", photoStatus: "all" };

// Checked means on.
function Toggle({ checked, onChange, label, title }) {
  return (
    <label className="signage-toggle signage-toggle--compact" title={title ?? (checked ? "Shown" : "Hidden")}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span className="signage-toggle-track" aria-hidden="true" />
    </label>
  );
}

function RoomRow({ room, action, onAction, accent = false }) {
  const { node, kind, placard } = room;
  return (
    <li className="node-row directory-admin-room-row">
      <span className={`photo-dot ${placard?.photo ? "has-photo" : "no-photo"}`} title={placard?.photo ? "Has photo" : "No photo yet"} />
      <div className="node-row-main">
        <div className="node-row-name">{room.roomName}</div>
        <div className="node-row-meta">
          {kind === "facility" ? "Facility · " : ""}
          {buildingLabel(node.building)} · {floorLabel(node.floor)} · {node.name}
          {placard?.department ? ` · ${placard.department}` : ""}
        </div>
      </div>
      <button
        type="button"
        className={accent ? "signage-btn signage-btn--accent" : "signage-btn"}
        onClick={onAction}
        aria-label={`${action} ${room.roomName}`}
      >
        {action}
      </button>
    </li>
  );
}

// Search and filters over every room on campus, with the rooms the directory
// lists on top and the ones still to add below. A room is added to, and
// removed from, its own building's directory.
function RoomPicker({ rooms, draft, onChange }) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const setFilter = (key, value) =>
    // A floor only exists in some buildings, so changing building resets it.
    setFilters((f) => (key === "building" ? { ...f, building: value, floor: "all" } : { ...f, [key]: value }));
  const filtersActive = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  const { listed, available } = useMemo(() => {
    const inScope = rooms.filter(({ node, placard }) => {
      if (filters.building !== "all" && node.building !== filters.building) return false;
      if (filters.floor !== "all" && String(node.floor) !== String(filters.floor)) return false;
      if (filters.type !== "all" && node.type !== filters.type) return false;
      if (filters.photoStatus === "missing" && placard?.photo) return false;
      if (filters.photoStatus === "has" && !placard?.photo) return false;
      return true;
    });
    const ranked = rankRoomMatches(filters.search, inScope);
    return {
      listed: ranked.filter((r) => isRoomListed(draft, r.node.building, r.roomName)),
      available: ranked.filter((r) => !isRoomListed(draft, r.node.building, r.roomName)),
    };
  }, [rooms, filters, draft]);

  const totalListed = rooms.filter((r) => isRoomListed(draft, r.node.building, r.roomName)).length;

  // Applies one change per building, since each building keeps its own list.
  const applyByBuilding = (matches, fn) => {
    const byBuilding = new Map();
    for (const r of matches) {
      const names = byBuilding.get(r.node.building) ?? [];
      names.push(r.roomName);
      byBuilding.set(r.node.building, names);
    }
    let next = draft;
    for (const [buildingId, names] of byBuilding) next = fn(next, buildingId, names);
    onChange(next);
  };

  return (
    <div className="directory-admin-editor">
      <section className="panel directory-admin-panel" aria-label="Search and filter">
        <h3>Search and Filter</h3>
        <div className="filter-panel-grid">
          <label className="filter-search-field">
            Search
            <span className="user-panel-search">
              <IconPlaceholder name="search-magnifier" className="user-panel-search-icon" />
              <input
                type="search"
                className="user-panel-search-input"
                value={filters.search}
                onChange={(e) => setFilter("search", e.target.value)}
                placeholder="Name, department, description or node"
              />
            </span>
          </label>
          <label>
            Building
            <select value={filters.building} onChange={(e) => setFilter("building", e.target.value)}>
              <option value="all">All</option>
              {allBuildings().map((b) => (
                <option key={b.id} value={b.id}>{b.label}</option>
              ))}
            </select>
          </label>
          <label>
            Floor
            <select value={filters.floor} onChange={(e) => setFilter("floor", e.target.value)}>
              <option value="all">All</option>
              {floorsForBuilding(filters.building).map((f) => (
                <option key={f} value={f}>{floorLabel(f)}</option>
              ))}
            </select>
          </label>
          <label>
            Type
            <select value={filters.type} onChange={(e) => setFilter("type", e.target.value)}>
              <option value="all">All</option>
              {NODE_TYPES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </label>
          <label>
            Photo status
            <select value={filters.photoStatus} onChange={(e) => setFilter("photoStatus", e.target.value)}>
              <option value="all">All</option>
              <option value="missing">Missing photo</option>
              <option value="has">Has photo filename</option>
            </select>
          </label>
        </div>
        {filtersActive && (
          <button type="button" className="signage-btn directory-admin-reset-filters" onClick={() => setFilters(DEFAULT_FILTERS)}>
            Reset filters
          </button>
        )}
      </section>

      <section className="panel directory-admin-panel" aria-label="Rooms in the directory">
        <div className="node-list-header">
          <h3>
            In the directory ({listed.length}
            {filtersActive ? ` of ${totalListed}` : ""})
          </h3>
          <button
            type="button"
            className="signage-btn"
            disabled={listed.length === 0}
            onClick={() => applyByBuilding(listed, removeRooms)}
          >
            Remove {listed.length > 0 ? `all ${listed.length} ` : ""}shown
          </button>
        </div>
        <ul className="directory-admin-results">
          {listed.map((r) => (
            <RoomRow
              key={`${r.node.building}::${r.roomName}`}
              room={r}
              action="Remove"
              onAction={() => onChange(removeRooms(draft, r.node.building, [r.roomName]))}
            />
          ))}
        </ul>
        {listed.length === 0 && (
          <p className="empty-hint">
            {totalListed === 0 ? "Nothing is listed. Visitors see no rooms in the directory." : "No listed room matches these filters."}
          </p>
        )}
      </section>

      <section className="panel directory-admin-panel" aria-label="Add rooms">
        <div className="node-list-header">
          <h3>Add rooms ({available.length})</h3>
          <button
            type="button"
            className="signage-btn signage-btn--accent"
            disabled={available.length === 0}
            onClick={() => applyByBuilding(available, addRooms)}
          >
            Add {available.length > 0 ? `all ${available.length} ` : ""}shown
          </button>
        </div>
        <ul className="directory-admin-results">
          {available.map((r) => (
            <RoomRow
              key={`${r.node.building}::${r.roomName}`}
              room={r}
              action="Add"
              accent
              onAction={() => onChange(addRooms(draft, r.node.building, [r.roomName]))}
            />
          ))}
        </ul>
        {available.length === 0 && (
          <p className="empty-hint">
            {filtersActive ? "No unlisted room matches these filters." : "Every room is already in the directory."}
          </p>
        )}
      </section>
    </div>
  );
}

// What the web app sidebar's Directory lists. Campuses and buildings are
// switched on or off. Rooms are searched across the whole campus and added to
// the directory, and each building can also be told to list rooms and
// facilities created later on its own. Search and the visitor-side filters
// are not affected: a visitor can still find an unlisted room by searching.
export default function DirectoryPage() {
  const { nodes } = useOutletContext();
  const { getForRoom } = usePlacardDialogs();
  const { settings, loading, error, saveSettings } = useDirectorySettings();
  const [edits, setEdits] = useState(null);
  const [saving, setSaving] = useState(false);
  const draft = edits ?? settings;
  const dirty = !!edits && !sameDirectorySettings(edits, settings);

  const rooms = useMemo(
    () => buildSearchableRooms(nodes, getForRoom, { includeWithoutDetails: true }),
    [nodes, getForRoom]
  );
  const buildings = allBuildings();
  const campuses = allCampuses();

  const patch = (fields) => setEdits({ ...draft, ...fields });
  const namesIn = (id) => roomsInBuilding(rooms, id).map((r) => r.roomName);
  const clearOne = (id) => setEdits(clearBuilding(draft, id, namesIn(id)));
  const clearAll = () => setEdits(buildings.reduce((acc, b) => clearBuilding(acc, b.id, namesIn(b.id)), draft));

  const save = async () => {
    setSaving(true);
    try {
      await saveSettings(draft);
      setEdits(null);
    } catch {
      // useDirectorySettings' mutate already reported it.
    } finally {
      setSaving(false);
    }
  };

  const nameOf = (b, siblings) => (siblings > 1 ? `${b.label} Building` : b.label);

  return (
    <div className="signage-page">
      <header className="signage-page-header">
        <div>
          <h2 className="admin-page-heading">Directory</h2>
          <p className="signage-page-intro">
            Choose what the web app sidebar's Directory lists. Search any room or facility and add it, or switch on
            "List incoming rooms/facilities" for a building so new ones appear without a visit here. Search and the
            visitor filters are not affected: a visitor can still find an unlisted room by searching for it. Changes
            apply when you save.
          </p>
        </div>
        <div className="signage-settings-actions">
          {dirty && (
            <button type="button" className="signage-btn" onClick={() => setEdits(null)} disabled={saving}>
              Discard
            </button>
          )}
          <button type="button" className="signage-add-btn" onClick={save} disabled={!dirty || saving}>
            {saving ? "Saving..." : "Save directory"}
          </button>
        </div>
      </header>

      {error && (
        <div className="error-box" role="alert">
          <p>Couldn't load the directory: {error}</p>
        </div>
      )}
      {loading && <p className="empty-hint">Loading...</p>}

      {!loading && !error && (
        <div className="directory-admin-layout">
          <nav className="directory-admin-nav" aria-label="Parent directories">
            <div className="signage-card directory-admin-nav-card">
              <div className="directory-admin-row">
                <div className="directory-admin-expand directory-admin-static">
                  <span className="directory-admin-name">Saved Directories</span>
                  <span className="signage-row-meta">A visitor's own saved rooms</span>
                </div>
                <Toggle checked={draft.showSaved} onChange={(showSaved) => patch({ showSaved })} label="Show Saved Directories" />
              </div>
            </div>

            {campuses.map((campus) => {
              const members = buildingsForCampus(buildings, campus.id, campusForBuilding);
              const campusShown = !draft.hiddenCampuses.includes(campus.id);
              return (
                <div className="signage-card directory-admin-nav-card" key={campus.id}>
                  <div className="directory-admin-row">
                    <div className="directory-admin-expand directory-admin-static">
                      <span className="directory-admin-name">{campus.label}</span>
                      <span className="signage-row-meta">
                        {members.length} {members.length === 1 ? "building" : "buildings"}
                      </span>
                    </div>
                    <Toggle
                      checked={campusShown}
                      onChange={(on) => patch({ hiddenCampuses: toggleInList(draft.hiddenCampuses, campus.id, !on) })}
                      label={`Show ${campus.label}`}
                    />
                  </div>
                  <ul className="directory-admin-building-list">
                    {members.map((b) => {
                      const buildingRooms = roomsInBuilding(rooms, b.id);
                      const listedCount = buildingRooms.filter((r) => isRoomListed(draft, b.id, r.roomName)).length;
                      const label = nameOf(b, members.length);
                      const incoming = entryFor(draft, b.id).incoming;
                      return (
                        <li key={b.id} className="directory-admin-building">
                          <div className="directory-admin-row">
                            <div className="directory-admin-expand directory-admin-static">
                              <span className="directory-admin-name">{label}</span>
                              <span className="signage-row-meta">
                                {listedCount} of {buildingRooms.length} listed
                                {campusShown ? "" : " (campus hidden)"}
                              </span>
                            </div>
                            <Toggle
                              checked={!draft.hiddenBuildings.includes(b.id)}
                              onChange={(on) => patch({ hiddenBuildings: toggleInList(draft.hiddenBuildings, b.id, !on) })}
                              label={`Show ${label}`}
                            />
                          </div>
                          <div className="directory-admin-row directory-admin-incoming">
                            <span className="signage-row-meta">List incoming rooms/facilities</span>
                            <Toggle
                              checked={incoming}
                              onChange={(on) => setEdits(setIncoming(draft, b.id, on))}
                              label={`List incoming rooms and facilities in ${label}`}
                              title={incoming ? "New rooms are listed" : "New rooms are not listed"}
                            />
                          </div>
                          <button
                            type="button"
                            className="signage-btn directory-admin-building-clear"
                            onClick={() => clearOne(b.id)}
                            disabled={listedCount === 0}
                            title={`Remove every room from ${label}'s list`}
                          >
                            Clear
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}

            <div className="signage-card directory-admin-nav-card">
              <span className="directory-admin-name">Everything</span>
              <div className="directory-admin-actions directory-admin-nav-actions">
                <button type="button" className="signage-btn" onClick={clearAll}>
                  Clear all rooms
                </button>
                <button
                  type="button"
                  className="signage-btn"
                  onClick={() => patch({ hiddenCampuses: [], hiddenBuildings: [], showSaved: true })}
                >
                  Show every directory
                </button>
              </div>
            </div>
          </nav>

          <RoomPicker rooms={rooms} draft={draft} onChange={setEdits} />
        </div>
      )}
    </div>
  );
}
