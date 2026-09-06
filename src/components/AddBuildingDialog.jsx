import { useState } from "react";
import { Map, Marker } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { osmRasterStyle } from "../utils/osmMapStyle";
import { allBuildings } from "../utils/constants";
import { addCustomBuilding, deleteCustomBuilding, getCustomBuildings, useCustomBuildingsVersion } from "../utils/buildingStore";

// No real campus coordinates were known at the time this was built — a
// generic, low-zoom world view until real coordinates make a better
// default center worth hardcoding.
const DEFAULT_MAP_CENTER = { lat: 0, lng: 0 };
const DEFAULT_MAP_ZOOM = 2;

export default function AddBuildingDialog({ onClose, nodes = [] }) {
  useCustomBuildingsVersion(); // keep the "existing buildings" list below in sync as they're added/deleted

  const [name, setName] = useState("");
  const [floorCount, setFloorCount] = useState("");
  // Optional — only buildings on a physically separate campus need this at
  // all, to power the cross-campus minimap flyover.
  const [location, setLocation] = useState(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

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
      onClose(building);
    } catch (err) {
      setError(err.message || "Couldn't create the building.");
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
      onClose({ deletedId: building.id });
    } catch (err) {
      setError(err.message || "Couldn't delete the building.");
    }
  };

  const customBuildings = getCustomBuildings();

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
            {customBuildings.length === 0 ? (
              <p className="empty-hint">No admin-created buildings yet — GD1/GD2/GD3 are built in.</p>
            ) : (
              <div className="custom-building-list">
                {customBuildings.map((b) => (
                  <div key={b.id} className="custom-building-row">
                    <span>{b.label}</span>
                    <span className="field-hint">{b.floors.length} floor{b.floors.length === 1 ? "" : "s"}</span>
                    <button type="button" className="danger" onClick={() => handleDelete(b)}>Delete</button>
                  </div>
                ))}
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
