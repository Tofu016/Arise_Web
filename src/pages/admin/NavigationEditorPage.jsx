import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import PanoramaNav from "../../components/PanoramaNav";
import NodeList from "../../components/NodeList";
import FilterPanel from "../../components/FilterPanel";
import { defaultHotspotAngle, floorLabel, buildingLabel, MARKER_TYPES, markerTypeInfo } from "../../utils/constants";
import { useSecurePhotoUrl } from "../../hooks/useSecurePhotoUrl";

const defaultFilters = {
  building: "all",
  floor: "all",
  type: "all",
  photoStatus: "all",
  search: "",
};

function newMarkerId() {
  return `m_${Date.now().toString(36)}${Math.floor(Math.random() * 1000).toString(36)}`;
}

// Promoted from the old NavigationTester modal to a full page — now the
// SOLE place neighbor-linking is managed (NodeForm's own picker was
// removed in Phase 2, per the redesign).
//
// The page's "current node" is the SAME shared selectedNodeId every other
// section uses, not a separate, page-local notion of "current" — so
// picking a node from this page's own Node List, and "walking" via a
// hotspot click while testing the link graph, both update the one shared
// selection. Switching to Node Editor afterward correctly reflects
// wherever navigation testing actually ended up, rather than the two
// pages silently disagreeing about which node is selected.
export default function NavigationEditorPage() {
  const { nodes, selectedNodeId, setSelectedNodeId, setNeighbors, setHotspot, setMarkers } = useOutletContext();

  const byId = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);
  const [history, setHistory] = useState([]);
  const [placingFor, setPlacingFor] = useState(null); // neighborId being positioned, or null
  // Marker placement: { mode: "new", type, label } before its first placement,
  // or { mode: "reposition", id } when moving an existing one.
  const [placingMarker, setPlacingMarker] = useState(null);
  const [addSearch, setAddSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [addingMarker, setAddingMarker] = useState(false);
  const [newMarkerType, setNewMarkerType] = useState(MARKER_TYPES[0].id);
  const [newMarkerLabel, setNewMarkerLabel] = useState("");
  const [photoMissing, setPhotoMissing] = useState(false);
  const [entryYaw, setEntryYaw] = useState(0);
  const [filters, setFilters] = useState(defaultFilters);

  const current = selectedNodeId ? byId[selectedNodeId] : null;
  const { url: securePhotoUrl } = useSecurePhotoUrl(current?.photo);

  useEffect(() => {
    if (securePhotoUrl) setPhotoMissing(false);
  }, [securePhotoUrl]);

  const hotspots = useMemo(() => {
    if (!current) return [];
    const neighborIds = current.neighbors || [];
    return neighborIds.map((nid, idx) => {
      const target = byId[nid];
      const angle = current.hotspots?.[nid] || defaultHotspotAngle(idx, neighborIds.length);
      return { id: nid, name: target?.name || nid, ...angle };
    });
  }, [current, byId]);

  const markers = current?.markers || [];

  // Selecting a node from this page's own Node List — a fresh jump, not a
  // "walk," so history resets, same as the public viewer's own
  // jumpToSearchResult vs goTo distinction.
  const handleSelectNode = (id) => {
    setHistory([]);
    setSelectedNodeId(id);
    setPlacingFor(null);
    setPlacingMarker(null);
    setPhotoMissing(false);
    setEntryYaw(0);
  };

  // Walking via a hotspot click while testing the link graph.
  const goTo = (id, angle) => {
    setHistory((h) => (selectedNodeId ? [...h, selectedNodeId] : h));
    setSelectedNodeId(id);
    setPlacingFor(null);
    setPlacingMarker(null);
    setPhotoMissing(false);
    setEntryYaw(angle?.yaw ?? 0);
  };

  const goBack = () => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const next = [...h];
      const prevId = next.pop();
      setSelectedNodeId(prevId);
      setPlacingFor(null);
      setPlacingMarker(null);
      setPhotoMissing(false);
      setEntryYaw(0);
      return next;
    });
  };

  const startReposition = (neighborId) => setPlacingFor(neighborId);

  const handlePlaceAngle = (angle) => {
    if (placingFor) {
      setHotspot(current.id, placingFor, angle);
      setPlacingFor(null);
      return;
    }
    if (placingMarker) {
      if (placingMarker.mode === "new") {
        const marker = { id: newMarkerId(), type: placingMarker.type, label: placingMarker.label, ...angle };
        setMarkers(current.id, [...markers, marker]);
      } else if (placingMarker.mode === "reposition") {
        setMarkers(
          current.id,
          markers.map((m) => (m.id === placingMarker.id ? { ...m, ...angle } : m))
        );
      }
      setPlacingMarker(null);
    }
  };

  const removeLink = (neighborId) => {
    setNeighbors(current.id, (current.neighbors || []).filter((id) => id !== neighborId));
  };

  const candidateNodes = useMemo(() => {
    if (!current || !addSearch.trim()) return [];
    const q = addSearch.toLowerCase();
    return nodes
      .filter((n) => n.id !== current.id && !(current.neighbors || []).includes(n.id))
      .filter((n) => n.id.toLowerCase().includes(q) || n.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [addSearch, nodes, current]);

  const addLink = (targetId) => {
    setNeighbors(current.id, [...(current.neighbors || []), targetId]);
    setAddSearch("");
    setAdding(false);
    setPlacingFor(targetId); // immediately ask where to put its arrow
  };

  const startAddMarker = () => {
    setAddingMarker(true);
    setNewMarkerType(MARKER_TYPES[0].id);
    setNewMarkerLabel("");
  };

  const confirmStartPlacingNewMarker = () => {
    if (!newMarkerLabel.trim()) return;
    setPlacingMarker({ mode: "new", type: newMarkerType, label: newMarkerLabel.trim() });
    setAddingMarker(false);
  };

  const startRepositionMarker = (id) => setPlacingMarker({ mode: "reposition", id });

  const removeMarker = (id) => {
    setMarkers(current.id, markers.filter((m) => m.id !== id));
  };

  const placing = !!placingFor || !!placingMarker;
  const photoUrl = current?.photo ? securePhotoUrl : null;

  // Sidebar (Filter + Node List) stays visible even with nothing selected
  // yet — this is how the admin actually gets started, not something to
  // hide behind an empty state.
  const sidebar = (
    <div className="navigation-editor-sidebar">
      <FilterPanel filters={filters} onChange={setFilters} />
      <NodeList
        nodes={nodes}
        filters={filters}
        selectedNodeId={selectedNodeId}
        onSelect={handleSelectNode}
      />
    </div>
  );

  if (!current) {
    return (
      <div className="navigation-editor-page">
        <div className="navigation-editor-main">
          <h2 className="admin-page-heading">Virtual Map Navigation Editor</h2>
          <p className="empty-hint">Select a node from the list on the right to start linking it up.</p>
        </div>
        {sidebar}
      </div>
    );
  }

  return (
    <div className="navigation-editor-page">
      <div className="navigation-editor-main">
        <h2 className="admin-page-heading">Virtual Map Navigation Editor</h2>

        {placingFor && (
          <div className="placing-banner">
            Click on the panorama to place the arrow toward "{byId[placingFor]?.name || placingFor}"
            <button onClick={() => setPlacingFor(null)}>Cancel</button>
          </div>
        )}
        {placingMarker && (
          <div className="placing-banner">
            Click on the panorama to place the marker
            {placingMarker.mode === "new" ? ` "${placingMarker.label}"` : ""}
            <button onClick={() => setPlacingMarker(null)}>Cancel</button>
          </div>
        )}

        <div className="preview-screen navigation-editor-screen">
          <PanoramaNav
            key={current.id}
            url={photoUrl || ""}
            hotspots={hotspots}
            markers={markers}
            onNavigate={goTo}
            onError={() => setPhotoMissing(true)}
            placing={placing}
            onPlaceAngle={handlePlaceAngle}
            initialYaw={entryYaw}
          />
        </div>
        {(!current.photo || photoMissing) && (
          <p className="photo-missing-note">
            No photo loaded for this node yet — hotspots still work for testing the link graph.
          </p>
        )}
        {current.photo && !photoUrl && !photoMissing && (
          <p className="photo-missing-note">Loading photo…</p>
        )}
        <p className="preview-hint">
          Left-click and drag to look around · click a link to teleport
          {history.length > 0 && (
            <button className="back-btn" onClick={goBack}>← Back</button>
          )}
        </p>

        <div className="navigation-editor-title-row">
          <h3>{current.name}</h3>
          <p className="preview-sub">
            {buildingLabel(current.building)} · {floorLabel(current.floor)} · {current.type}
          </p>
        </div>

        <div className="navigation-editor-lists">
          <div className="navigation-editor-list-col">
            <h5>Links added ({hotspots.length})</h5>
            <div className="link-list navigation-editor-scroll-list">
              {hotspots.length === 0 && <p className="empty-hint">No links yet.</p>}
              {hotspots.map((h) => (
                <div key={h.id} className="link-row">
                  <span className="link-name">{h.name}</span>
                  <div className="link-actions">
                    <button onClick={() => startReposition(h.id)}>Reposition</button>
                    <button className="danger" onClick={() => removeLink(h.id)}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="navigation-editor-list-col">
            <h5>Markers added ({markers.length})</h5>
            <div className="link-list navigation-editor-scroll-list">
              {markers.length === 0 && <p className="empty-hint">No markers yet — rooms, facilities, exits, hydrants.</p>}
              {markers.map((m) => {
                const info = markerTypeInfo(m.type);
                return (
                  <div key={m.id} className="link-row">
                    <span className="link-name">{info.icon} {m.label}</span>
                    <div className="link-actions">
                      <button onClick={() => startRepositionMarker(m.id)}>Reposition</button>
                      <button className="danger" onClick={() => removeMarker(m.id)}>Remove</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="navigation-editor-add-row">
          <div className="navigation-editor-add-col">
            <h5>Links</h5>
            {!adding ? (
              <button className="add-link-btn" onClick={() => setAdding(true)}>+ Add Links</button>
            ) : (
              <div className="add-link-box">
                <input
                  type="text"
                  autoFocus
                  placeholder="Search node by name or ID..."
                  value={addSearch}
                  onChange={(e) => setAddSearch(e.target.value)}
                />
                <div className="add-link-results">
                  {candidateNodes.map((n) => (
                    <div key={n.id} className="add-link-result" onClick={() => addLink(n.id)}>
                      {n.name} <span className="neighbor-id">{n.id}</span>
                    </div>
                  ))}
                  {addSearch && candidateNodes.length === 0 && (
                    <p className="empty-hint">No matches.</p>
                  )}
                </div>
                <button onClick={() => { setAdding(false); setAddSearch(""); }}>Cancel</button>
              </div>
            )}
          </div>

          <div className="navigation-editor-add-col">
            <h5>Markers</h5>
            {!addingMarker ? (
              <button className="add-link-btn" onClick={startAddMarker}>+ Add Markers</button>
            ) : (
              <div className="add-link-box">
                <select
                  value={newMarkerType}
                  onChange={(e) => { setNewMarkerType(e.target.value); setNewMarkerLabel(""); }}
                >
                  {MARKER_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>{t.icon} {t.label}</option>
                  ))}
                </select>
                {newMarkerType === "room" ? (
                  (current.rooms || []).length > 0 ? (
                    <select
                      value={newMarkerLabel}
                      onChange={(e) => setNewMarkerLabel(e.target.value)}
                    >
                      <option value="">Pick a room served by this node…</option>
                      {current.rooms.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="empty-hint">
                      This node has no "Rooms served" yet — add one via Node Editor first.
                    </p>
                  )
                ) : (
                  <input
                    type="text"
                    autoFocus
                    placeholder="Label, e.g. Restroom"
                    value={newMarkerLabel}
                    onChange={(e) => setNewMarkerLabel(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && confirmStartPlacingNewMarker()}
                  />
                )}
                <button onClick={confirmStartPlacingNewMarker} disabled={!newMarkerLabel.trim()}>
                  Place on panorama
                </button>
                <button onClick={() => setAddingMarker(false)}>Cancel</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {sidebar}
    </div>
  );
}
