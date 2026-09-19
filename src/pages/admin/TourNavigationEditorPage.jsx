import { useState } from "react";
import { useTourStops } from "../../hooks/useTourStops";
import { useTourSections } from "../../hooks/useTourSections";
import PanoramaNav from "../../components/PanoramaNav";
import TourStopList from "../../components/TourStopList";
import FilePickerButton from "../../components/FilePickerButton";
import { photoFilename, uploadPhoto } from "../../utils/photoStore";
import { newMarkerId } from "../../utils/placement";
import { useGraphEditor } from "../../hooks/useGraphEditor";

// Campus Tour equivalent of Virtual Map Navigation Editor — the same
// walking/linking/placing mechanic (stop-to-stop hotspots), shared through
// useGraphEditor, and it reuses PanoramaNav.jsx directly. The marker
// system here is genuinely different from the indoor side's: instead of
// picking a type (room/facility/exit/hydrant) and a plain text label, an
// equipment marker is a label plus a set of photos that open in a carousel
// on the public page ("Click to view photos") — there's no type picker at
// all, every marker created here is the one "equipment" type.
//
// Unlike the indoor system's marker, its id is generated up front, as soon
// as "+ Add Marker" is started — the photos need a stable id to be named
// around while the admin is still picking them, which happens BEFORE
// placement, not after.
//
// Calls useTourStops()/useTourSections() directly, same as
// TourStopsPage.jsx — not shared Outlet context yet (see that page's own
// comment on this; still just these two Campus Tour admin pages, so
// nothing to share the selection with outside this file yet either).
export default function TourNavigationEditorPage() {
  const { stops, selectedStopId, setSelectedStopId, setNeighbors, setHotspot, setMarkers } = useTourStops();
  const { sections } = useTourSections();

  const editor = useGraphEditor({
    items: stops,
    selectedId: selectedStopId,
    setSelectedId: setSelectedStopId,
    setNeighbors,
    setHotspot,
    setMarkers,
  });
  const { current, hotspots, markers, byId, placingFor, placingMarker, photoUrl, photoMissing, history } = editor;

  const [addingMarker, setAddingMarker] = useState(false);
  const [newMarkerLabel, setNewMarkerLabel] = useState("");
  const [pendingMarkerId, setPendingMarkerId] = useState(null);
  const [newMarkerPhotos, setNewMarkerPhotos] = useState([]); // storage paths
  const [markerUploadState, setMarkerUploadState] = useState("idle");
  const [sectionFilter, setSectionFilter] = useState("all");

  const startAddMarker = () => {
    setAddingMarker(true);
    setNewMarkerLabel("");
    setPendingMarkerId(newMarkerId());
    setNewMarkerPhotos([]);
    setMarkerUploadState("idle");
  };

  const handleMarkerPhotosPick = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setMarkerUploadState("uploading");
    try {
      const uploaded = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Named after the marker's own (already-generated) id plus an
        // index, so several photos on the same marker don't collide with
        // each other, and re-adding more photos later keeps appending
        // rather than overwriting an earlier one at the same index.
        const filename = photoFilename(file, `${pendingMarkerId}_${newMarkerPhotos.length + i}`);
        const { path } = await uploadPhoto("tourMarker", file, { filename });
        uploaded.push(path);
      }
      setNewMarkerPhotos((prev) => [...prev, ...uploaded]);
      setMarkerUploadState("done");
      setTimeout(() => setMarkerUploadState((s) => (s === "done" ? "idle" : s)), 2500);
    } catch {
      setMarkerUploadState("error");
    }
  };

  const removeNewMarkerPhoto = (path) => {
    setNewMarkerPhotos((prev) => prev.filter((p) => p !== path));
  };

  const confirmStartPlacingNewMarker = () => {
    if (!newMarkerLabel.trim() || newMarkerPhotos.length === 0) return;
    editor.startPlacingMarker({
      id: pendingMarkerId,
      type: "equipment",
      label: newMarkerLabel.trim(),
      photos: newMarkerPhotos,
    });
    setAddingMarker(false);
  };

  const sidebar = (
    <div className="navigation-editor-sidebar">
      <div className="panel">
        <h3>Filter</h3>
        <label>
          Section
          <select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)}>
            <option value="all">All</option>
            {sections.map((sec) => (
              <option key={sec.id} value={sec.id}>{sec.label}</option>
            ))}
          </select>
        </label>
      </div>
      <TourStopList
        stops={stops}
        sections={sections}
        sectionFilter={sectionFilter}
        selectedStopId={selectedStopId}
        onSelect={editor.select}
      />
    </div>
  );

  if (!current) {
    return (
      <div className="navigation-editor-page">
        <div className="navigation-editor-main">
          <h2 className="admin-page-heading">Campus Tour Navigation Editor</h2>
          <p className="empty-hint">Select a tour stop from the list on the right to start linking it up.</p>
        </div>
        {sidebar}
      </div>
    );
  }

  return (
    <div className="navigation-editor-page">
      <div className="navigation-editor-main">
        <h2 className="admin-page-heading">Campus Tour Navigation Editor</h2>

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
            No photo loaded for this stop yet — hotspots still work for testing the link graph.
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
            {sections.find((sec) => sec.id === current.section)?.label || "No section"}
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
              {markers.length === 0 && <p className="empty-hint">No equipment markers yet.</p>}
              {markers.map((m) => (
                <div key={m.id} className="link-row">
                  <span className="link-name">📷 {m.label} ({(m.photos || []).length} photo{(m.photos || []).length === 1 ? "" : "s"})</span>
                  <div className="link-actions">
                    <button onClick={() => editor.startRepositionMarker(m.id)}>Reposition</button>
                    <button className="danger" onClick={() => editor.removeMarker(m.id)}>Remove</button>
                  </div>
                </div>
              ))}
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
                  placeholder="Search stop by name or ID..."
                  value={editor.addSearch}
                  onChange={(e) => editor.setAddSearch(e.target.value)}
                />
                <div className="add-link-results">
                  {editor.candidates.map((s) => (
                    <div key={s.id} className="add-link-result" onClick={() => editor.addLink(s.id)}>
                      {s.name} <span className="neighbor-id">{s.id}</span>
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
              <button className="add-link-btn" onClick={startAddMarker}>+ Add Marker</button>
            ) : (
              <div className="add-link-box">
                <input
                  type="text"
                  autoFocus
                  placeholder="Label, e.g. X-ray Machine"
                  value={newMarkerLabel}
                  onChange={(e) => setNewMarkerLabel(e.target.value)}
                />
                <FilePickerButton
                  accept="image/*"
                  multiple
                  onChange={handleMarkerPhotosPick}
                  disabled={markerUploadState === "uploading"}
                  label="Choose Photos"
                />
                <span className="field-hint">
                  {markerUploadState === "uploading" && "Uploading…"}
                  {markerUploadState === "error" && "⚠ Upload failed — check Storage rules/connection."}
                  {newMarkerPhotos.length === 0 && markerUploadState !== "uploading" && "No photos picked yet — at least one is required."}
                </span>
                {newMarkerPhotos.length > 0 && (
                  <div className="face-review-manual-chips">
                    {newMarkerPhotos.map((p) => (
                      <span key={p} className="face-review-manual-chip">
                        {p.split("/").pop()}
                        <button type="button" onClick={() => removeNewMarkerPhoto(p)}>×</button>
                      </span>
                    ))}
                  </div>
                )}
                <button
                  onClick={confirmStartPlacingNewMarker}
                  disabled={!newMarkerLabel.trim() || newMarkerPhotos.length === 0 || markerUploadState === "uploading"}
                >
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
