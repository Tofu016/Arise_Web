import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import NodeList from "../../components/NodeList";
import FilterPanel from "../../components/FilterPanel";
import { GraphEditorBanners, GraphEditorPreview, LinkList, AddLinkBox } from "../../components/GraphEditorControls";
import { floorLabel, buildingLabel, floorsForBuilding, MARKER_TYPES, markerTypeInfo } from "../../utils/constants";
import { newMarkerId } from "../../utils/placement";
import { useGraphEditor } from "../../hooks/useGraphEditor";
import { validateElevator, validateElevatorLanding, floorsWithLandingsDropped } from "../../utils/elevators";

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
    elevators,
    addElevator,
    updateElevator,
    deleteElevator,
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
  // "" | "_new" | an existing elevator id — see the elevator branch below.
  const [newMarkerElevatorId, setNewMarkerElevatorId] = useState("");
  const [newElevatorDraft, setNewElevatorDraft] = useState({ id: "", label: "", accessibleFloors: [] });
  const [elevatorFormError, setElevatorFormError] = useState("");
  const [filters, setFilters] = useState(defaultFilters);
  const [managingElevatorId, setManagingElevatorId] = useState(null); // editing an existing elevator's floors, from the list below
  const [editElevatorFloors, setEditElevatorFloors] = useState([]);
  const [editElevatorError, setEditElevatorError] = useState("");

  // Only elevators already in this node's building can get a landing here
  // — a landing marker and its elevator must agree on building (enforced
  // server-side too).
  const elevatorsHere = current ? elevators.filter((e) => e.building === current.building) : [];

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
    setNewMarkerElevatorId("");
    setNewElevatorDraft({ id: "", label: "", accessibleFloors: current ? [current.floor] : [] });
    setElevatorFormError("");
  };

  const isElevator = newMarkerType === "elevator";
  const isCreatingElevator = isElevator && newMarkerElevatorId === "_new";
  const selectedElevator = isElevator ? elevatorsHere.find((e) => e.id === newMarkerElevatorId) : null;
  const landingErrors =
    isElevator && !isCreatingElevator && current ? validateElevatorLanding(selectedElevator, current) : [];

  const canConfirmMarker = isElevator
    ? !!selectedElevator && landingErrors.length === 0
    : !!newMarkerLabel.trim();

  const toggleNewElevatorFloor = (floor) => {
    setNewElevatorDraft((d) => ({
      ...d,
      accessibleFloors: d.accessibleFloors.includes(floor)
        ? d.accessibleFloors.filter((f) => f !== floor)
        : [...d.accessibleFloors, floor].sort((a, b) => a - b),
    }));
  };

  // Creates the elevator record itself (Elevators_API), then selects it —
  // placing its first landing is a second, separate step below, since a
  // brand-new elevator has nowhere to land yet.
  const confirmCreateElevator = async () => {
    if (!current) return;
    const draft = { ...newElevatorDraft, id: newElevatorDraft.id.trim(), label: newElevatorDraft.label.trim() };
    const errors = validateElevator(
      { ...draft, building: current.building },
      { buildingFloors: floorsForBuilding(current.building), existingIds: elevators.map((e) => e.id), isNew: true }
    );
    if (errors.length > 0) {
      setElevatorFormError(errors.join(" "));
      return;
    }
    try {
      await addElevator({ ...draft, building: current.building });
      setNewMarkerElevatorId(draft.id);
      setElevatorFormError("");
    } catch {
      // A specific toast already fired via addElevator's own mutate() call
      // (e.g. a duplicate id caught server-side); the form just stays open.
    }
  };

  const confirmStartPlacingNewMarker = () => {
    if (!canConfirmMarker) return;
    const marker = isElevator
      ? { id: newMarkerId(), type: "elevator", elevatorId: selectedElevator.id, label: selectedElevator.label }
      : { id: newMarkerId(), type: newMarkerType, label: newMarkerLabel.trim() };
    editor.startPlacingMarker(marker);
    setAddingMarker(false);
  };

  // Editing an existing elevator's own accessible floors, from the list
  // below — dropping a floor that still has a landing is rejected with the
  // offending node named, both as a local pre-check (floorsWithLandingsDropped)
  // and, just in case another admin's edit raced this one, by the backend's
  // own 409 (surfaced via updateElevator's toast).
  const startManageElevator = (elevator) => {
    setManagingElevatorId(elevator.id);
    setEditElevatorFloors(elevator.accessibleFloors);
    setEditElevatorError("");
  };
  const toggleEditElevatorFloor = (floor) => {
    setEditElevatorFloors((floors) =>
      floors.includes(floor) ? floors.filter((f) => f !== floor) : [...floors, floor].sort((a, b) => a - b)
    );
  };
  const confirmSaveElevatorFloors = async (elevator) => {
    const dropped = floorsWithLandingsDropped(elevator, editElevatorFloors);
    if (dropped.length > 0) {
      setEditElevatorError(
        `Remove the landing(s) on ${dropped.map((l) => `${floorLabel(l.floor)} (${l.nodeId})`).join(", ")} first.`
      );
      return;
    }
    if (editElevatorFloors.length < 2) {
      setEditElevatorError("Keep at least 2 accessible floors.");
      return;
    }
    try {
      await updateElevator(elevator.id, { accessibleFloors: editElevatorFloors });
      setManagingElevatorId(null);
    } catch {
      // toast already fired
    }
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
                    <span className="link-name">
                      {info.icon} {m.label}
                      {m.type === "elevator" && (
                        <span className="portal-tag">
                          {m.elevatorId} · serves: {(m.accessibleFloors || []).map(floorLabel).join(", ")}
                        </span>
                      )}
                    </span>
                    <div className="link-actions">
                      <button onClick={() => editor.startRepositionMarker(m.id)}>Reposition</button>
                      <button className="danger" onClick={() => editor.removeMarker(m.id)}>Remove</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="navigation-editor-list-col">
            <h5>Elevators in {buildingLabel(current.building)} ({elevatorsHere.length})</h5>
            <div className="link-list navigation-editor-scroll-list">
              {elevatorsHere.length === 0 && (
                <p className="empty-hint">No elevators in this building yet — add one below when placing a landing.</p>
              )}
              {elevatorsHere.map((e) => (
                <div key={e.id} className="link-row elevator-manage-row">
                  {managingElevatorId === e.id ? (
                    <>
                      <span className="link-name">{e.label} <span className="elevator-picker-sub">({e.id})</span></span>
                      <div className="elevator-floor-checkboxes">
                        {floorsForBuilding(e.building).map((f) => (
                          <label key={f} className="elevator-floor-checkbox">
                            <input
                              type="checkbox"
                              checked={editElevatorFloors.includes(f)}
                              onChange={() => toggleEditElevatorFloor(f)}
                            />
                            {floorLabel(f)}
                          </label>
                        ))}
                      </div>
                      {editElevatorError && <p className="directions-error">{editElevatorError}</p>}
                      <div className="link-actions">
                        <button onClick={() => confirmSaveElevatorFloors(e)}>Save floors</button>
                        <button onClick={() => setManagingElevatorId(null)}>Cancel</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="link-name">
                        {e.label}
                        <span className="portal-tag">
                          {e.id} · serves: {e.accessibleFloors.map(floorLabel).join(", ")} · {e.landings.length} landing(s)
                        </span>
                      </span>
                      <div className="link-actions">
                        <button onClick={() => startManageElevator(e)}>Edit floors</button>
                        <button
                          className="danger"
                          onClick={() => window.confirm(`Delete elevator "${e.label}"? This removes all ${e.landings.length} of its landing markers too.`) && deleteElevator(e.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
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
                ) : isElevator ? (
                  <>
                    <select value={newMarkerElevatorId} onChange={(e) => setNewMarkerElevatorId(e.target.value)}>
                      <option value="">Pick an elevator…</option>
                      {elevatorsHere.map((e) => (
                        <option key={e.id} value={e.id}>{e.label} ({e.id})</option>
                      ))}
                      <option value="_new">+ New elevator…</option>
                    </select>
                    {isCreatingElevator ? (
                      <>
                        <input
                          type="text"
                          autoFocus
                          placeholder="Elevator ID, e.g. gd1-elevator-a"
                          value={newElevatorDraft.id}
                          onChange={(e) => setNewElevatorDraft((d) => ({ ...d, id: e.target.value }))}
                        />
                        <input
                          type="text"
                          placeholder="Label, e.g. Elevator A"
                          value={newElevatorDraft.label}
                          onChange={(e) => setNewElevatorDraft((d) => ({ ...d, label: e.target.value }))}
                        />
                        <p className="field-hint">
                          One record for this whole physical elevator — every floor it serves shares
                          this same record, so its floor list can never disagree from one landing to another.
                        </p>
                        <div className="elevator-floor-checkboxes">
                          {floorsForBuilding(current.building).map((f) => (
                            <label key={f} className="elevator-floor-checkbox">
                              <input
                                type="checkbox"
                                checked={newElevatorDraft.accessibleFloors.includes(f)}
                                onChange={() => toggleNewElevatorFloor(f)}
                              />
                              {floorLabel(f)}
                            </label>
                          ))}
                        </div>
                        {elevatorFormError && <p className="directions-error">{elevatorFormError}</p>}
                        <button onClick={confirmCreateElevator}>Create elevator</button>
                      </>
                    ) : (
                      selectedElevator && (
                        <p className="field-hint">
                          Serves: {selectedElevator.accessibleFloors.map(floorLabel).join(", ")} ·{" "}
                          {selectedElevator.landings.length} landing(s) already placed.
                        </p>
                      )
                    )}
                    {landingErrors.map((err) => (
                      <p key={err} className="directions-error">{err}</p>
                    ))}
                  </>
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
                <button onClick={confirmStartPlacingNewMarker} disabled={!canConfirmMarker}>
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
