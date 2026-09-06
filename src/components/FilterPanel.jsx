import { NODE_TYPES, allBuildings, floorLabel, floorsForBuilding } from "../utils/constants";
import { useCustomBuildingsVersion } from "../utils/buildingStore";

export default function FilterPanel({ filters, onChange }) {
  useCustomBuildingsVersion(); // re-render when an admin-created building is added

  const set = (key, value) => {
    if (key === "building") {
      // Changing building invalidates any floor selection that doesn't exist there.
      onChange({ ...filters, building: value, floor: "all" });
      return;
    }
    onChange({ ...filters, [key]: value });
  };

  const floorOptions = filters.building === "all" ? floorsForBuilding("all") : floorsForBuilding(filters.building);

  return (
    <div className="panel filter-panel">
      <h3>Filter</h3>

      <div className="filter-panel-grid">
        <label>
          Building
          <select value={filters.building} onChange={(e) => set("building", e.target.value)}>
            <option value="all">All</option>
            {allBuildings().map((b) => (
              <option key={b.id} value={b.id}>{b.label}</option>
            ))}
          </select>
        </label>

        <label>
          Floor
          <select value={filters.floor} onChange={(e) => set("floor", e.target.value)}>
            <option value="all">All</option>
            {floorOptions.map((f) => (
              <option key={f} value={f}>{floorLabel(f)}</option>
            ))}
          </select>
        </label>

        <label>
          Type
          <select value={filters.type} onChange={(e) => set("type", e.target.value)}>
            <option value="all">All</option>
            {NODE_TYPES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </label>

        <label>
          Photo status
          <select value={filters.photoStatus} onChange={(e) => set("photoStatus", e.target.value)}>
            <option value="all">All</option>
            <option value="missing">Missing photo</option>
            <option value="has">Has photo filename</option>
          </select>
        </label>
      </div>
    </div>
  );
}
