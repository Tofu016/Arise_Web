import { useState } from "react";
import { Map, Marker } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { osmRasterStyle } from "../utils/osmMapStyle";
import { allBuildings, BUILDINGS, buildingLabel, floorsForBuilding } from "../utils/constants";
import { planBuildingMove } from "../utils/buildingMove";
import { addCustomBuilding, deleteCustomBuilding, getServerBuildingNames, updateBuilding, useCustomBuildingsVersion } from "../utils/buildingStore";
import { useToast } from "../context/ToastContext";

// No real campus coordinates were known at the time this was built — a
// generic, low-zoom world view until real coordinates make a better
// default center worth hardcoding.
const DEFAULT_MAP_CENTER = { lat: 0, lng: 0 };
const DEFAULT_MAP_ZOOM = 2;

export default function AddBuildingDialog({ onClose, nodes = [], onMoveNodes }) {
  useCustomBuildingsVersion(); // keep the "existing buildings" list below in sync as they're added/deleted
  const toast = useToast();

  const [name, setName] = useState("");
  const [floorCount, setFloorCount] = useState("");
  // Optional — only buildings on a physically separate campus need this at
  // all, to power the cross-campus minimap flyover.
  const [location, setLocation] = useState(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  // Which existing building is being edited, and its draft name/floors.
  const [editingId, setEditingId] = useState(null);
  const [nameDraft, setNameDraft] = useState("");
  const [floorsDraft, setFloorsDraft] = useState("");
  // Which building's nodes are being moved elsewhere, and where to.
  const [movingId, setMovingId] = useState(null);
  const [moveTarget, setMoveTarget] = useState("");
  const [moveBusy, setMoveBusy] = useState(false);

  const handleCreate = async () => {
    setError("");
    setCreating(true);
    try {
      const reservedIds = allBuildings().map((b) => b.id);
      const building = await addCustomBuilding({
        name,
        floorCount,
        reservedIds,
        lat: location?.lat,
        lng: location?.lng,
      });
      setName("");
      setFloorCount("");
      setLocation(null);
      toast.success(`Building "${building.label}" created.`);
      onClose(building);
    } catch (err) {
      const message = err.message || "Couldn't create the building.";
      setError(message);
      toast.error(message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (building) => {
    const affected = nodes.filter((n) => n.building === building.id).length;
    const warning = affected > 0
      ? `${affected} node(s) currently use "${building.label}". They won't be deleted, but this building will disappear from filters and dropdowns until you re-add it.\n\nDelete "${building.label}" anyway?`
      : `Delete building "${building.label}"?`;
    if (!confirm(warning)) return;
    try {
      await deleteCustomBuilding(building.id);
      toast.success(`Building "${building.label}" deleted.`);
      onClose({ deletedId: building.id });
    } catch (err) {
      const message = err.message || "Couldn't delete the building.";
      setError(message);
      toast.error(message);
    }
  };

  const handleSaveEdit = async (building) => {
    setError("");
    const edit = { name: nameDraft };
    // Built-in floors come from verified constants, so only admin-created
    // buildings have an editable floor count.
    if (!building.builtIn) {
      edit.floorCount = floorsDraft;
      const newCount = Math.floor(Number(floorsDraft));
      const stranded = nodes.filter((n) => n.building === building.id && n.floor > newCount).length;
      if (stranded > 0 && !confirm(`${stranded} node(s) are on floors above ${newCount}. They won't be deleted, but those floors will no longer exist for "${building.label}".

Reduce the floor count anyway?`)) {
        return;
      }
    }
    try {
      await updateBuilding(building.id, edit);
      setEditingId(null);
      toast.success(`Building "${building.label}" saved.`);
    } catch (err) {
      const message = err.message || "Couldn't save the building.";
      setError(message);
      toast.error(message);
    }
  };

  const movePlan = movingId && moveTarget
    ? planBuildingMove(nodes, movingId, moveTarget, floorsForBuilding(moveTarget))
    : null;

  const handleMove = async () => {
    if (!movePlan || movePlan.problems.length > 0) return;
    setError("");
    setMoveBusy(true);
    try {
      await onMoveNodes(movePlan.moves, moveTarget);
      setMovingId(null);
    } catch (err) {
      setError(err.message || "Couldn't move the nodes.");
    } finally {
      setMoveBusy(false);
    }
  };

  const builtInIds = BUILDINGS.map((b) => b.id);
  const serverNames = getServerBuildingNames();
  // Built-ins can be edited only once they have a backend row.
  const existing = allBuildings().map((b) => ({
    ...b,
    builtIn: builtInIds.includes(b.id),
    editable: b.id in serverNames,
  }));

  return (
    <div className="modal-overlay" onClick={() => onClose(null)}>
      <div className="modal add-building-modal" onClick={(e) => e.stopPropagation()}>
        <div className="preview-header">
          <h3>New Building</h3>
          <button className="close-btn" onClick={() => onClose(null)}>✕</button>
        </div>

        <div className="add-building-columns">
          <div className="add-building-form-col">
            <h4 className="add-building-subheading">Add New Building</h4>

            <label>
              Building name
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. GD4"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </label>

            <label>
              Number of floors
              <input
                type="number"
                min="1"
                step="1"
                value={floorCount}
                onChange={(e) => setFloorCount(e.target.value)}
                placeholder="e.g. 6"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              <span className="field-hint">
                Floors will be numbered 1 through the count you enter — you can rename/relabel individual floors later if needed.
              </span>
            </label>

            <label>
              Real-world location <span className="field-hint" style={{ display: "inline" }}>(optional)</span>
              <span className="field-hint">
                Only needed for a building on a physically separate campus — powers cross-campus directions on the minimap. Click the map to set it.
              </span>
            </label>
            <div className="building-location-picker">
              <Map
                initialViewState={{
                  longitude: DEFAULT_MAP_CENTER.lng,
                  latitude: DEFAULT_MAP_CENTER.lat,
                  zoom: DEFAULT_MAP_ZOOM,
                }}
                mapStyle={osmRasterStyle}
                style={{ height: 320, borderRadius: 8 }}
                onClick={(e) => setLocation({ lat: e.lngLat.lat, lng: e.lngLat.lng })}
              >
                {location && <Marker longitude={location.lng} latitude={location.lat} />}
              </Map>
              {location && (
                <div className="building-location-readout">
                  <span>{location.lat.toFixed(5)}, {location.lng.toFixed(5)}</span>
                  <button type="button" onClick={() => setLocation(null)}>Clear</button>
                </div>
              )}
            </div>
          </div>

          <div className="add-building-existing-col">
            <h4 className="add-building-subheading">Existing Building/s</h4>
            <div className="custom-building-list">
              {existing.map((b) => (
                <div key={b.id} className="custom-building-row">
                  {editingId === b.id ? (
                    <div className="custom-building-edit">
                      <label>
                        Name
                        <input
                          type="text"
                          value={nameDraft}
                          onChange={(e) => setNameDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit(b);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          autoFocus
                        />
                      </label>
                      <label>
                        Floors
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={floorsDraft}
                          disabled={b.builtIn}
                          title={b.builtIn ? "Built-in floors are fixed" : undefined}
                          onChange={(e) => setFloorsDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit(b);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                      </label>
                      <div className="custom-building-edit-actions">
                        <button type="button" className="primary" onClick={() => handleSaveEdit(b)}>Save</button>
                        <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span>{b.label}</span>
                      <span className="field-hint">
                        {b.builtIn ? "built in" : `${b.floors.length} floor${b.floors.length === 1 ? "" : "s"}`}
                      </span>
                      <button
                        type="button"
                        disabled={!b.editable}
                        title={b.editable ? undefined : "No backend record for this building yet"}
                        onClick={() => {
                          setError("");
                          setEditingId(b.id);
                          setNameDraft(b.label);
                          setFloorsDraft(String(floorsForBuilding(b.id).length));
                        }}
                      >
                        Edit
                      </button>
                      {onMoveNodes && nodes.some((n) => n.building === b.id) && (
                        <button
                          type="button"
                          onClick={() => {
                            setError("");
                            setMovingId(b.id);
                            setMoveTarget("");
                          }}
                        >
                          Move nodes
                        </button>
                      )}
                      {!b.builtIn && (
                        <button type="button" className="danger" onClick={() => handleDelete(b)}>Delete</button>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>

            {movingId && (
              <div className="building-move-panel">
                <p>
                  Move all {nodes.filter((n) => n.building === movingId).length} node(s) in{" "}
                  <strong>{buildingLabel(movingId)}</strong> to:
                </p>
                <select value={moveTarget} onChange={(e) => setMoveTarget(e.target.value)}>
                  <option value="">Choose a building…</option>
                  {existing.filter((b) => b.id !== movingId).map((b) => (
                    <option key={b.id} value={b.id}>{b.label}</option>
                  ))}
                </select>
                {movePlan && movePlan.problems.length > 0 && (
                  <ul className="building-move-problems">
                    {movePlan.problems.map((p) => <li key={p}>{p}</li>)}
                  </ul>
                )}
                {movePlan && movePlan.problems.length === 0 && (
                  <span className="field-hint">
                    IDs change from <code>{movingId}_…</code> to <code>{moveTarget}_…</code>; floors, links and rooms are kept.
                  </span>
                )}
                <div className="custom-building-edit-actions">
                  <button
                    type="button"
                    className="primary"
                    disabled={moveBusy || !movePlan || movePlan.problems.length > 0}
                    onClick={handleMove}
                  >
                    {moveBusy ? "Moving…" : "Move nodes"}
                  </button>
                  <button type="button" onClick={() => setMovingId(null)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="error-box">
            <p>{error}</p>
          </div>
        )}

        <div className="form-actions">
          <button className="primary" onClick={handleCreate} disabled={creating}>
            {creating ? "Creating…" : "Create building"}
          </button>
          <button onClick={() => onClose(null)}>Close</button>
        </div>
      </div>
    </div>
  );
}
