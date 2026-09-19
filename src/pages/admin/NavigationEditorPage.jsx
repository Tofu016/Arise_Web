import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import PanoramaNav from "../../components/PanoramaNav";
import NodeList from "../../components/NodeList";
import FilterPanel from "../../components/FilterPanel";
import { floorLabel, buildingLabel, MARKER_TYPES, markerTypeInfo } from "../../utils/constants";
import { newMarkerId } from "../../utils/placement";
import { useGraphEditor } from "../../hooks/useGraphEditor";

const defaultFilters = {
  building: "all",
  floor: "all",
  type: "all",
  photoStatus: "all",
  search: "",
};

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
//
// The placement mechanic (walking, linking, placing links and markers on
// the panorama) is shared with the tour editor — see useGraphEditor. What
// is specific to nodes lives here: the typed markers, and the sidebar.
export default function NavigationEditorPage() {
  const { nodes, selectedNodeId, setSelectedNodeId, setNeighbors, setHotspot, setMarkers } = useOutletContext();

  const editor = useGraphEditor({
    items: nodes,
    selectedId: selectedNodeId,
    setSelectedId: setSelectedNodeId,
    setNeighbors,
    setHotspot,
    setMarkers,
  });
  const { current, hotspots, markers, byId, placingFor, placingMarker, photoUrl, photoMissing, history } = editor;

  const [addingMarker, setAddingMarker] = useState(false);
  const [newMarkerType, setNewMarkerType] = useState(MARKER_TYPES[0].id);
  const [newMarkerLabel, setNewMarkerLabel] = useState("");
  const [filters, setFilters] = useState(defaultFilters);

  const startAddMarker = () => {
    setAddingMarker(true);
    setNewMarkerType(MARKER_TYPES[0].id);
    setNewMarkerLabel("");
  };

  const confirmStartPlacingNewMarker = () => {
    if (!newMarkerLabel.trim()) return;
    editor.startPlacingMarker({ id: newMarkerId(), type: newMarkerType, label: newMarkerLabel.trim() });
    setAddingMarker(false);
  };

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
        onSelect={editor.select}
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
            <button onClick={editor.cancelLinkPlacement}>Cancel</button>
          </div>
        )}
        {placingMarker && (
          <div className="placing-banner">
            Click on the panorama to place the marker
            {placingMarker.mode === "new" ? ` "${placingMarker.marker.label}"` : ""}
            <button onClick={editor.cancelMarkerPlacement}>Cancel</button>
          </div>
        )}

        <div className="preview-screen navigation-editor-screen">
          <PanoramaNav
            key={current.id}
            url={photoUrl || ""}
            hotspots={hotspots}
            markers={markers}
            onNavigate={editor.goTo}
            onError={() => editor.setPhotoMissing(true)}
            placing={editor.placing}
            onPlaceAngle={editor.placeAngle}
            initialYaw={editor.entryYaw}
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
            <button className="back-btn" onClick={editor.goBack}>← Back</button>
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
                    <button onClick={() => editor.startRepositionLink(h.id)}>Reposition</button>
                    <button className="danger" onClick={() => editor.removeLink(h.id)}>Remove</button>
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
                      <button onClick={() => editor.startRepositionMarker(m.id)}>Reposition</button>
                      <button className="danger" onClick={() => editor.removeMarker(m.id)}>Remove</button>
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
            {!editor.adding ? (
              <button className="add-link-btn" onClick={() => editor.setAdding(true)}>+ Add Links</button>
            ) : (
              <div className="add-link-box">
                <input
                  type="text"
                  autoFocus
                  placeholder="Search node by name or ID..."
                  value={editor.addSearch}
                  onChange={(e) => editor.setAddSearch(e.target.value)}
                />
                <div className="add-link-results">
                  {editor.candidates.map((n) => (
                    <div key={n.id} className="add-link-result" onClick={() => editor.addLink(n.id)}>
                      {n.name} <span className="neighbor-id">{n.id}</span>
                    </div>
                  ))}
                  {editor.addSearch && editor.candidates.length === 0 && (
                    <p className="empty-hint">No matches.</p>
                  )}
                </div>
                <button onClick={editor.cancelAddingLink}>Cancel</button>
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
