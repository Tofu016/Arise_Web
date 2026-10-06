import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { usePlacardDialogs } from "../../hooks/usePlacardDialogs";
import { NODE_TYPES, allBuildings, buildingLabel, floorLabel, floorsForBuilding } from "../../utils/constants";
import { buildSearchableRooms, rankRoomMatches } from "../../utils/search";
import { normalizeRoomName } from "../../utils/entities";
import { fuzzyIncludes } from "../../utils/fuzzy";
import { generateOcrTerms } from "../../utils/ocrTerms";
import { matchRoomsFromOcr } from "../../utils/ocrRoomMatch";
import {
  addExtraTerm,
  addToOcr,
  hasRoom360Photo,
  hasStaleTerms,
  ocrCollisions,
  ocrStateOf,
  ocrStateProblem,
  removeExtraTerm,
  removeFromOcr,
  sameOcrState,
  withOcrState,
} from "../../utils/ocrSettings";
import IconPlaceholder from "../../components/IconPlaceholder";

const DEFAULT_FILTERS = { search: "", building: "all", floor: "all", type: "all", photo360: "all" };
const keyOf = (room) => normalizeRoomName(room.roomName);

function roomMeta(room) {
  const { node, kind, placard } = room;
  return [
    kind === "facility" ? "Facility" : null,
    buildingLabel(node.building),
    floorLabel(node.floor),
    node.name,
    placard?.department || null,
  ]
    .filter(Boolean)
    .join(" · ");
}

// A room's extra search terms: chips, and a box to type another one in.
function ExtraTermsField({ roomName, state, onChange }) {
  const [text, setText] = useState("");
  const [hint, setHint] = useState("");

  const add = () => {
    const { state: next, refused } = addExtraTerm(state, text);
    if (refused === "duplicate") {
      setHint("Already a search term.");
      return;
    }
    setHint("");
    setText("");
    if (!refused) onChange(next);
  };

  return (
    <div className="ocr-admin-field">
      <span className="ocr-admin-field-label">Extra search terms</span>
      <div className="room-chip-input">
        <input
          type="text"
          value={text}
          maxLength={100}
          onChange={(e) => {
            setText(e.target.value);
            setHint("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="e.g. a misread you saw on the phone"
          aria-label={`Add an extra search term for ${roomName}`}
        />
        <button type="button" onClick={add} disabled={!text.trim()}>
          Add
        </button>
      </div>
      {hint && <span className="ocr-admin-field-hint">{hint}</span>}
      {state.extraTerms.length > 0 && (
        <div className="room-chips">
          {state.extraTerms.map((t) => (
            <span key={t} className="room-chip">
              {t}
              <button type="button" onClick={() => onChange(removeExtraTerm(state, t))} aria-label={`Remove ${t}`}>
                <IconPlaceholder name="close" className="ocr-admin-chip-remove" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// One room on OCR: its Placard name, the terms it generates, its extra
// terms, and anything worth knowing before a visitor scans it.
function EligibleRoom({ room, state, collisions, unsaved, onChange, onRemove }) {
  const problem = ocrStateProblem(state);
  const generated = generateOcrTerms(state.placardName);
  const differs = state.placardName.trim() !== room.roomName;
  const nameId = `ocr-placard-${keyOf(room)}`;

  return (
    <li className={"ocr-admin-room" + (problem ? " ocr-admin-room--problem" : "")}>
      <div className="ocr-admin-room-head">
        <span
          className={`photo-dot ${hasRoom360Photo(room) ? "has-photo" : "no-photo"}`}
          title={hasRoom360Photo(room) ? "Has a 360 photo" : "No 360 photo yet"}
        />
        <div className="node-row-main">
          <div className="node-row-name">
            {room.roomName}
            {unsaved && <span className="ocr-admin-tag">Unsaved</span>}
          </div>
          <div className="node-row-meta">{roomMeta(room)}</div>
        </div>
        <button type="button" className="signage-btn" onClick={onRemove} aria-label={`Remove ${room.roomName} from OCR`}>
          Remove
        </button>
      </div>

      <div className="ocr-admin-fields">
        <div className="ocr-admin-field">
          <label className="ocr-admin-field-label" htmlFor={nameId}>
            Placard name
          </label>
          <input
            id={nameId}
            type="text"
            className="ocr-admin-input"
            value={state.placardName}
            maxLength={255}
            aria-invalid={problem ? "true" : undefined}
            onChange={(e) => onChange({ ...state, placardName: e.target.value })}
          />
          {problem && (
            <span className="ocr-admin-field-error" role="alert">
              {problem}
            </span>
          )}
          {!problem && differs && (
            <span className="ocr-admin-field-hint">
              Differs from the room name.{" "}
              <button type="button" className="signage-link-btn" onClick={() => onChange({ ...state, placardName: room.roomName })}>
                Use "{room.roomName}"
              </button>
            </span>
          )}
          {generated.length > 0 && (
            <div className="ocr-admin-generated" aria-label="Generated search terms">
              {generated.map((t) => (
                <span key={t} className="ocr-admin-term" title="Generated from the Placard name">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
        <ExtraTermsField roomName={room.roomName} state={state} onChange={onChange} />
      </div>

      {(collisions?.length > 0 || !hasRoom360Photo(room)) && (
        <ul className="ocr-admin-notes">
          {collisions?.map((c) => (
            <li key={c.term} className="ocr-admin-note">
              "{c.term}" is also a search term of {c.roomNames.join(", ")}. A scan reading it asks the visitor which room they mean.
            </li>
          ))}
          {!hasRoom360Photo(room) && (
            <li className="ocr-admin-note">No 360 photo yet, so View in AR has nothing to show after a scan. Add one in the Room and Facility Editor.</li>
          )}
        </ul>
      )}
    </li>
  );
}

function AvailableRoom({ room, onAdd }) {
  return (
    <li className="node-row directory-admin-room-row">
      <span
        className={`photo-dot ${hasRoom360Photo(room) ? "has-photo" : "no-photo"}`}
        title={hasRoom360Photo(room) ? "Has a 360 photo" : "No 360 photo yet"}
      />
      <div className="node-row-main">
        <div className="node-row-name">{room.roomName}</div>
        <div className="node-row-meta">{roomMeta(room)}</div>
      </div>
      <button type="button" className="signage-btn signage-btn--accent" onClick={onAdd} aria-label={`Add ${room.roomName} to OCR`}>
        Add
      </button>
    </li>
  );
}

function testSummary(matches) {
  if (matches[0].isExact) return `Opens ${matches[0].room.roomName} straight away.`;
  if (matches.filter((m) => m.matchesTerm).length > 1) return "Matches a search term several rooms share, so the phone asks which one.";
  return "No exact match, so the phone shows these as suggestions.";
}

function testBadge(match) {
  if (match.isExact) return "Opens";
  if (match.matchesTerm) return "Shared term";
  return `${Math.round(match.score * 100)}%`;
}

// What a phone would do with a read, against the rooms as they'd be saved.
function TestReadCard({ rooms }) {
  const [read, setRead] = useState("");
  const matches = useMemo(() => matchRoomsFromOcr(read, rooms).slice(0, 5), [read, rooms]);

  return (
    <section className="signage-card ocr-admin-side-card" aria-label="Test a read">
      <div className="signage-card-head">
        <h3>Test a read</h3>
        <span className="signage-card-sub">Includes unsaved changes</span>
      </div>
      <label className="ocr-admin-field">
        <span className="ocr-admin-field-label">Text the phone read from a placard</span>
        <input type="text" className="ocr-admin-input" value={read} onChange={(e) => setRead(e.target.value)} placeholder="e.g. GD1 - 101" />
      </label>
      {read.trim() && matches.length === 0 && <p className="empty-hint">No room on OCR matches. The phone would say "No matching room found".</p>}
      {matches.length > 0 && (
        <>
          <p className="ocr-admin-test-summary">{testSummary(matches)}</p>
          <ul className="ocr-admin-test-results">
            {matches.map((m) => (
              <li key={keyOf(m.room)} className="ocr-admin-test-result">
                <div className="node-row-main">
                  <div className="node-row-name">{m.room.roomName}</div>
                  <div className="node-row-meta">{m.room.placard.placardName || m.room.roomName}</div>
                </div>
                <span className={"ocr-admin-badge" + (m.isExact ? " ocr-admin-badge--exact" : "")}>{testBadge(m)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

// Which rooms and facilities the mobile app's placard scanner can match, and
// what each one's placard says. A room is matched by search terms generated
// from its Placard name (the room name unless an admin changes it) plus any
// extra terms typed here; see utils/ocrTerms.js. Nothing saves until Save.
export default function OcrManagementPage() {
  const { nodes } = useOutletContext();
  const { getForRoom, saveOcrSettings, loading, error } = usePlacardDialogs();
  const [edits, setEdits] = useState({});
  // Eligible rooms whose stored terms an admin asked to regenerate.
  const [regenerate, setRegenerate] = useState(() => new Set());
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [saving, setSaving] = useState(false);

  const rooms = useMemo(() => buildSearchableRooms(nodes, getForRoom, { includeWithoutDetails: true }), [nodes, getForRoom]);
  const stateFor = (room) => edits[keyOf(room)] ?? ocrStateOf(room);
  const setStateFor = (room, next) =>
    setEdits((prev) => {
      const out = { ...prev };
      if (sameOcrState(next, ocrStateOf(room))) delete out[keyOf(room)];
      else out[keyOf(room)] = next;
      return out;
    });
  const setStatesFor = (list, fn) =>
    setEdits((prev) => {
      const out = { ...prev };
      for (const room of list) {
        const next = fn(prev[keyOf(room)] ?? ocrStateOf(room), room);
        if (sameOcrState(next, ocrStateOf(room))) delete out[keyOf(room)];
        else out[keyOf(room)] = next;
      }
      return out;
    });

  // Every room as it will be once saved, and the eligible ones among them.
  const previewRooms = useMemo(() => rooms.map((r) => withOcrState(r, edits[keyOf(r)] ?? ocrStateOf(r))), [rooms, edits]);
  const eligiblePreview = useMemo(() => previewRooms.filter((r) => r.placard.ocrEnabled), [previewRooms]);
  const collisions = useMemo(() => ocrCollisions(eligiblePreview, keyOf), [eligiblePreview]);

  const staleRooms = rooms.filter((r) => hasStaleTerms(r) && !regenerate.has(keyOf(r)) && !edits[keyOf(r)]);
  const changedKeys = new Set([...Object.keys(edits), ...regenerate]);
  const dirty = changedKeys.size > 0;
  const problems = rooms.filter((r) => edits[keyOf(r)] && ocrStateProblem(edits[keyOf(r)]));

  // Nothing here saves on its own, so a refresh or closing the tab with
  // unsaved edits asks first (the browser shows its own "Leave site?").
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const discard = () => {
    setEdits({});
    setRegenerate(new Set());
  };

  const save = async () => {
    const rows = rooms.filter((r) => changedKeys.has(keyOf(r))).map((r) => ({ roomName: r.roomName, ...stateFor(r) }));
    setSaving(true);
    try {
      await saveOcrSettings(rows);
      discard();
    } catch {
      // usePlacardDialogs' mutate already reported it.
    } finally {
      setSaving(false);
    }
  };

  const setFilter = (key, value) =>
    // A floor only exists in some buildings, so changing building resets it.
    setFilters((f) => (key === "building" ? { ...f, building: value, floor: "all" } : { ...f, [key]: value }));
  const filtersActive = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  const { eligible, available } = useMemo(() => {
    const inScope = rooms.filter((room) => {
      const { node } = room;
      if (filters.building !== "all" && node.building !== filters.building) return false;
      if (filters.floor !== "all" && String(node.floor) !== String(filters.floor)) return false;
      if (filters.type !== "all" && node.type !== filters.type) return false;
      if (filters.photo360 === "missing" && hasRoom360Photo(room)) return false;
      if (filters.photo360 === "has" && !hasRoom360Photo(room)) return false;
      return true;
    });
    // The usual room search, plus the Placard name and extra terms, which
    // only this page knows about.
    const ranked = rankRoomMatches(filters.search, inScope);
    const rankedSet = new Set(ranked);
    const byPlacard = filters.search.trim()
      ? inScope.filter((r) => {
          if (rankedSet.has(r)) return false;
          const s = edits[keyOf(r)] ?? ocrStateOf(r);
          return fuzzyIncludes(filters.search, [s.placardName, ...s.extraTerms]);
        })
      : [];
    const matches = [...ranked, ...byPlacard];
    const isOn = (r) => (edits[keyOf(r)] ?? ocrStateOf(r)).ocrEnabled;
    return { eligible: matches.filter(isOn), available: matches.filter((r) => !isOn(r)) };
  }, [rooms, filters, edits]);

  const totalEligible = eligiblePreview.length;
  const without360 = eligiblePreview.filter((r) => !hasRoom360Photo(r)).length;

  return (
    <div className="signage-page directory-admin-page">
      {/* Sticky, so Save stays in reach while scrolling the room lists. */}
      <header className="signage-page-header directory-admin-header">
        <div>
          <h2 className="admin-page-heading">OCR Management</h2>
          <p className="signage-page-intro">
            Choose which rooms and facilities the mobile app's placard scanner can recognize. Each one is matched by the
            name printed on its placard: its Placard name starts as the room name and can be changed to match the sign.
            Search terms are generated from it, ignoring case, spacing and accents, and you can add extra ones for
            misreads. Changes apply when you save.
          </p>
        </div>
        <div className="signage-settings-actions">
          {dirty && (
            <span className="directory-admin-unsaved" role="status">
              {problems.length > 0 ? "Fix the highlighted rooms to save" : "Unsaved changes"}
            </span>
          )}
          {dirty && (
            <button type="button" className="signage-btn" onClick={discard} disabled={saving}>
              Discard
            </button>
          )}
          <button type="button" className="signage-add-btn" onClick={save} disabled={!dirty || saving || problems.length > 0}>
            {saving ? "Saving..." : "Save OCR settings"}
          </button>
        </div>
      </header>

      {error && (
        <div className="error-box" role="alert">
          <p>Couldn't load the room details: {error}</p>
        </div>
      )}
      {loading && <p className="empty-hint">Loading...</p>}

      {!loading && !error && (
        <>
          {staleRooms.length > 0 && (
            <div className="ocr-admin-banner" role="status">
              <span>
                {staleRooms.length} {staleRooms.length === 1 ? "room on OCR has" : "rooms on OCR have"} search terms in an
                older format. They still match, but regenerating adds the forms with dashes, apostrophes and spaces.
                Regenerated rooms save with your other changes.
              </span>
              <button
                type="button"
                className="signage-btn"
                onClick={() => setRegenerate((prev) => new Set([...prev, ...staleRooms.map(keyOf)]))}
              >
                Regenerate {staleRooms.length === 1 ? "it" : `all ${staleRooms.length}`}
              </button>
            </div>
          )}

          <div className="directory-admin-layout">
            <aside className="directory-admin-nav">
              <section className="signage-card ocr-admin-side-card" aria-label="Summary">
                <div className="signage-card-head">
                  <h3>On OCR</h3>
                </div>
                <dl className="ocr-admin-stats">
                  <div>
                    <dt>Rooms and facilities</dt>
                    <dd>
                      {totalEligible} of {rooms.length}
                    </dd>
                  </div>
                  <div>
                    <dt>Without a 360 photo</dt>
                    <dd>{without360}</dd>
                  </div>
                  <div>
                    <dt>Sharing a search term</dt>
                    <dd>{collisions.size}</dd>
                  </div>
                </dl>
              </section>
              <TestReadCard rooms={eligiblePreview} />
            </aside>

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
                        placeholder="Name, Placard name, search term, department or node"
                      />
                    </span>
                  </label>
                  <label>
                    Building
                    <select value={filters.building} onChange={(e) => setFilter("building", e.target.value)}>
                      <option value="all">All</option>
                      {allBuildings().map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Floor
                    <select value={filters.floor} onChange={(e) => setFilter("floor", e.target.value)}>
                      <option value="all">All</option>
                      {floorsForBuilding(filters.building).map((f) => (
                        <option key={f} value={f}>
                          {floorLabel(f)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Type
                    <select value={filters.type} onChange={(e) => setFilter("type", e.target.value)}>
                      <option value="all">All</option>
                      {NODE_TYPES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    360 photo
                    <select value={filters.photo360} onChange={(e) => setFilter("photo360", e.target.value)}>
                      <option value="all">All</option>
                      <option value="missing">Missing 360 photo</option>
                      <option value="has">Has 360 photo</option>
                    </select>
                  </label>
                </div>
                {filtersActive && (
                  <button type="button" className="signage-btn directory-admin-reset-filters" onClick={() => setFilters(DEFAULT_FILTERS)}>
                    Reset filters
                  </button>
                )}
              </section>

              <section className="panel directory-admin-panel" aria-label="Rooms on OCR">
                <div className="node-list-header">
                  <h3>
                    On OCR ({eligible.length}
                    {filtersActive ? ` of ${totalEligible}` : ""})
                  </h3>
                  <button
                    type="button"
                    className="signage-btn"
                    disabled={eligible.length === 0}
                    onClick={() => setStatesFor(eligible, (s) => removeFromOcr(s))}
                  >
                    Remove {eligible.length > 0 ? `all ${eligible.length} ` : ""}shown
                  </button>
                </div>
                <ul className="ocr-admin-room-list">
                  {eligible.map((r) => (
                    <EligibleRoom
                      key={keyOf(r)}
                      room={r}
                      state={stateFor(r)}
                      collisions={collisions.get(keyOf(r))}
                      unsaved={changedKeys.has(keyOf(r))}
                      onChange={(next) => setStateFor(r, next)}
                      onRemove={() => setStateFor(r, removeFromOcr(stateFor(r)))}
                    />
                  ))}
                </ul>
                {eligible.length === 0 && (
                  <p className="empty-hint">
                    {totalEligible === 0 ? "No room is on OCR yet. The scanner recognizes nothing." : "No room on OCR matches these filters."}
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
                    onClick={() => setStatesFor(available, (s, room) => addToOcr(s, room.roomName))}
                  >
                    Add {available.length > 0 ? `all ${available.length} ` : ""}shown
                  </button>
                </div>
                <ul className="directory-admin-results">
                  {available.map((r) => (
                    <AvailableRoom key={keyOf(r)} room={r} onAdd={() => setStateFor(r, addToOcr(stateFor(r), r.roomName))} />
                  ))}
                </ul>
                {available.length === 0 && (
                  <p className="empty-hint">{filtersActive ? "No room off OCR matches these filters." : "Every room is already on OCR."}</p>
                )}
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
