import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import NodeList from "../../components/NodeList";
import FilterPanel from "../../components/FilterPanel";
import { GraphEditorBanners, GraphEditorPreview, LinkList, AddLinkBox } from "../../components/GraphEditorControls";
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
  const {
    nodes,
    selectedNodeId,
    setSelectedNodeId,
    setNeighbors,
    setHotspot,
    setMarkers,
    setDefaultView,
    clearDefaultView,
    updateNode,
  } = useOutletContext();

  // The starting node's own "default view" (shown when the kiosk drops a
  // visitor here from the floor/building picker) isn't a per-edge thing
  // like the hotspot default views useGraphEditor already owns, so it's
  // captured through the same requestCapture() channel via onCaptureFallback:
  // whichever capture isn't claimed by a pending hotspot default view falls
  // through to here.
  const [settingStartingView, setSettingStartingView] = useState(false);

  const editor = useGraphEditor({
    items: nodes,
    selectedId: selectedNodeId,
    setSelectedId: setSelectedNodeId,
    setNeighbors,
    setHotspot,
    setMarkers,
    setDefaultView,
    clearDefaultView,
    onCaptureFallback: (angle) => {
      // The starting view is set without navigating away — the node
      // selected when capture was started is still the current one.
      if (!settingStartingView || !selectedNodeId) return;
      updateNode(selectedNodeId, { startingViewYaw: angle.yaw, startingViewPitch: angle.pitch });
      setSettingStartingView(false);
    },
  });
  const { current, markers } = editor;

  const [addingMarker, setAddingMarker] = useState(false);
  const [newMarkerType, setNewMarkerType] = useState(MARKER_TYPES[0].id);
  const [newMarkerLabel, setNewMarkerLabel] = useState("");
  const [filters, setFilters] = useState(defaultFilters);

  // Capturing the starting view requires staying put on this node — any
  // navigation away (including a hotspot-default-view capture walking to a
  // neighbor) invalidates a pending capture.
  useEffect(() => {
    setSettingStartingView(false);
  }, [selectedNodeId]);

  const startSetStartingView = () => {
    setSettingStartingView(true);
    editor.cancelSetDefaultView();
  };
  const cancelStartingView = () => setSettingStartingView(false);
  const clearStartingView = () => {
    if (!current) return;
    updateNode(current.id, { startingViewYaw: null, startingViewPitch: null });
  };

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

        <GraphEditorBanners editor={editor}>
          {settingStartingView && (
            <div className="placing-banner">
              Drag to orbit to the view visitors should land on when dropped here from the floor/building picker, then Save.
              <button onClick={editor.requestCapture}>Save this view</button>
              <button onClick={cancelStartingView}>Cancel</button>
            </div>
          )}
        </GraphEditorBanners>

        <GraphEditorPreview editor={editor} itemNoun="node" />

        <div className="navigation-editor-title-row">
          <h3>{current.name}</h3>
          <p className="preview-sub">
            {buildingLabel(current.building)} · {floorLabel(current.floor)} · {current.type}
          </p>
        </div>

        <div className="link-row starting-view-row">
          <span className="link-name">
            Starting view (floor/building picker drop-in):{" "}
            {current.startingViewYaw != null
              ? `set (yaw ${Math.round(current.startingViewYaw)}°, pitch ${Math.round(current.startingViewPitch)}°)`
              : "not set — falls back to the panorama's default facing"}
          </span>
          <div className="link-actions">
            <button onClick={startSetStartingView} disabled={settingStartingView}>
              {current.startingViewYaw != null ? "Reset" : "Set"} starting view
            </button>
            {current.startingViewYaw != null && (
              <button className="danger" onClick={clearStartingView}>Clear</button>
            )}
          </div>
        </div>

        <div className="navigation-editor-lists">
          <LinkList editor={editor} />

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
          <AddLinkBox editor={editor} itemNoun="node" />

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
