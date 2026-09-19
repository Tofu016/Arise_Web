import { useEffect, useMemo, useState } from "react";
import { useTourStops } from "../../hooks/useTourStops";
import { useTourSections } from "../../hooks/useTourSections";
import PanoramaNav from "../../components/PanoramaNav";
import TourStopList from "../../components/TourStopList";
import FilePickerButton from "../../components/FilePickerButton";
import { defaultHotspotAngle } from "../../utils/constants";
import { photoFilename, uploadPhoto } from "../../utils/photoStore";
import { useSecurePhotoUrl } from "../../hooks/useSecurePhotoUrl";

function newMarkerId() {
  return `m_${Date.now().toString(36)}${Math.floor(Math.random() * 1000).toString(36)}`;
}

// Campus Tour equivalent of Virtual Map Navigation Editor — same walking/
// linking mechanic (stop-to-stop hotspots), reuses PanoramaNav.jsx
// directly since it's generic enough not to need any changes for this.
// The marker system here is genuinely different from the indoor side's:
// instead of picking a type (room/facility/exit/hydrant) and a plain
// text label, an equipment marker is a label plus a set of photos that
// open in a carousel on the public page ("Click to view photos") —
// there's no type picker at all, every marker created here is the one
// "equipment" type.
//
// Calls useTourStops()/useTourSections() directly, same as
// TourStopsPage.jsx — not shared Outlet context yet (see that page's own
// comment on this; still just these two Campus Tour admin pages, so
// nothing to share the selection with outside this file yet either).
export default function TourNavigationEditorPage() {
  const { stops, selectedStopId, setSelectedStopId, setNeighbors, setHotspot, setMarkers } = useTourStops();
  const { sections } = useTourSections();

  const byId = useMemo(() => Object.fromEntries(stops.map((s) => [s.id, s])), [stops]);
  const [history, setHistory] = useState([]);
  const [placingFor, setPlacingFor] = useState(null); // neighborId being positioned, or null
  // Marker placement: { mode: "new", id, label, photos } before its first
  // placement, or { mode: "reposition", id } when moving an existing one.
  // Unlike the indoor system's newMarkerId() (generated only at the
  // moment of placement), the id here is generated up front, as soon as
  // "+ Add Marker" is started — the photos need a stable id to be named
  // around while the admin is still picking them, which happens BEFORE
  // placement, not after.
  const [placingMarker, setPlacingMarker] = useState(null);
  const [addSearch, setAddSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [addingMarker, setAddingMarker] = useState(false);
  const [newMarkerLabel, setNewMarkerLabel] = useState("");
  const [newMarkerId_, setNewMarkerId_] = useState(null);
  const [newMarkerPhotos, setNewMarkerPhotos] = useState([]); // storage paths
  const [markerUploadState, setMarkerUploadState] = useState("idle");
  const [photoMissing, setPhotoMissing] = useState(false);
  const [entryYaw, setEntryYaw] = useState(0);
  const [sectionFilter, setSectionFilter] = useState("all");

  const current = selectedStopId ? byId[selectedStopId] : null;
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

  const handleSelectStop = (id) => {
    setHistory([]);
    setSelectedStopId(id);
    setPlacingFor(null);
    setPlacingMarker(null);
    setPhotoMissing(false);
    setEntryYaw(0);
  };

  const goTo = (id, angle) => {
    setHistory((h) => (selectedStopId ? [...h, selectedStopId] : h));
    setSelectedStopId(id);
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
      setSelectedStopId(prevId);
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
        const marker = {
          id: placingMarker.id,
          type: "equipment",
          label: placingMarker.label,
          photos: placingMarker.photos,
          ...angle,
        };
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

  const candidateStops = useMemo(() => {
    if (!current || !addSearch.trim()) return [];
    const q = addSearch.toLowerCase();
    return stops
      .filter((s) => s.id !== current.id && !(current.neighbors || []).includes(s.id))
      .filter((s) => s.id.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [addSearch, stops, current]);

  const addLink = (targetId) => {
    setNeighbors(current.id, [...(current.neighbors || []), targetId]);
    setAddSearch("");
    setAdding(false);
    setPlacingFor(targetId);
  };

  const startAddMarker = () => {
    setAddingMarker(true);
    setNewMarkerLabel("");
    setNewMarkerId_(newMarkerId());
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
        const filename = photoFilename(file, `${newMarkerId_}_${newMarkerPhotos.length + i}`);
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
    setPlacingMarker({
      mode: "new",
      id: newMarkerId_,
      label: newMarkerLabel.trim(),
      photos: newMarkerPhotos,
    });
    setAddingMarker(false);
  };

  const startRepositionMarker = (id) => setPlacingMarker({ mode: "reposition", id });

  const removeMarker = (id) => {
    setMarkers(current.id, markers.filter((m) => m.id !== id));
  };

  const placing = !!placingFor || !!placingMarker;
  const photoUrl = current?.photo ? securePhotoUrl : null;

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
        onSelect={handleSelectStop}
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
            No photo loaded for this stop yet — hotspots still work for testing the link graph.
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
              {markers.length === 0 && <p className="empty-hint">No equipment markers yet.</p>}
              {markers.map((m) => (
                <div key={m.id} className="link-row">
                  <span className="link-name">📷 {m.label} ({(m.photos || []).length} photo{(m.photos || []).length === 1 ? "" : "s"})</span>
                  <div className="link-actions">
                    <button onClick={() => startRepositionMarker(m.id)}>Reposition</button>
                    <button className="danger" onClick={() => removeMarker(m.id)}>Remove</button>
                  </div>
                </div>
              ))}
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
                  placeholder="Search stop by name or ID..."
                  value={addSearch}
                  onChange={(e) => setAddSearch(e.target.value)}
                />
                <div className="add-link-results">
                  {candidateStops.map((s) => (
                    <div key={s.id} className="add-link-result" onClick={() => addLink(s.id)}>
                      {s.name} <span className="neighbor-id">{s.id}</span>
                    </div>
                  ))}
                  {addSearch && candidateStops.length === 0 && (
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
