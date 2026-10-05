import { useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { buildingLabel, floorLabel, MARKER_TYPES, markerTypeInfo } from "../../utils/constants";
import { MARKER_PROBLEMS, inventoryMarkers } from "../../utils/markers";
import { normalize } from "../../utils/fuzzy";
import { usePlacardDialogs } from "../../hooks/usePlacardDialogs";
import IconPlaceholder from "../../components/IconPlaceholder";

function SummaryCard({ label, count, warn }) {
  return (
    <div className="emergency-coverage-card">
      <span className="emergency-coverage-card-label">{label}</span>
      <span className={"emergency-coverage-card-count" + (warn && count > 0 ? " emergency-coverage-card-warn" : "")}>
        {count}
      </span>
    </div>
  );
}

// Every marker on every node in one place: what exists, where, and what is
// wrong with it. Placing and moving a marker needs the panorama, so that
// stays in the Navigation Editor; this page is for auditing the
// whole campus and removing markers in bulk. Editing a label is not offered
// because the backend call behind it only carries position (see planMarkers).
export default function MarkerManagementPage() {
  const { nodes, elevators = [], setMarkers, setSelectedNodeId } = useOutletContext();
  const navigate = useNavigate();
  const [building, setBuilding] = useState("all");
  const [type, setType] = useState("all");
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState(null);
  // getForRoom changes identity when the details list loads, which is what
  // re-runs the facility "no details" check.
  const { getForRoom } = usePlacardDialogs();

  const rows = useMemo(() => inventoryMarkers(nodes, elevators, getForRoom), [nodes, elevators, getForRoom]);
  const buildings = useMemo(() => [...new Set(nodes.map((n) => n.building))].sort(), [nodes]);

  const q = normalize(query);
  const inScope = (r) =>
    (building === "all" || r.building === building) &&
    (type === "all" || r.type === type) &&
    (!onlyProblems || r.problems.length > 0) &&
    (!q || normalize(r.label).includes(q) || normalize(r.nodeName).includes(q) || normalize(r.nodeId).includes(q));
  const shown = rows.filter(inScope);
  const inBuilding = rows.filter((r) => building === "all" || r.building === building);

  const openInEditor = (nodeId) => {
    setSelectedNodeId(nodeId);
    navigate("/admin/navigation-editor");
  };

  const remove = async (row) => {
    const name = row.label || markerTypeInfo(row.type).label;
    const detailsNote = row.type === "facility" ? " Its saved details are deleted too, unless another room or facility uses the name." : "";
    if (!window.confirm(`Delete the ${markerTypeInfo(row.type).label} marker "${name}" on ${row.nodeName}?${detailsNote} This can't be undone.`)) return;
    const node = nodes.find((n) => n.id === row.nodeId);
    setBusyId(row.id);
    try {
      await setMarkers(row.nodeId, node.markers.filter((m) => m.id !== row.id));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="emergency-coverage-page">
      <header>
        <h2 className="admin-page-heading">Marker Management</h2>
        <p className="signage-page-intro">
          Every point-of-interest marker across the Virtual Map, with a check for markers that are likely to be
          mistakes. Place or move a marker in the Navigation Editor, where the panorama is; use this
          page to find problems and remove markers. An elevator marker's label and floors come from its Elevator
          record.
        </p>
      </header>

      <div className="emergency-coverage-summary">
        <SummaryCard label="Markers" count={inBuilding.length} />
        {MARKER_TYPES.map((t) => (
          <SummaryCard key={t.id} label={t.label} count={inBuilding.filter((r) => r.type === t.id).length} />
        ))}
        <SummaryCard label="With problems" count={inBuilding.filter((r) => r.problems.length > 0).length} warn />
      </div>

      <div className="emergency-coverage-filters">
        <label className="emergency-coverage-filter">
          Building
          <select value={building} onChange={(e) => setBuilding(e.target.value)}>
            <option value="all">All buildings</option>
            {buildings.map((b) => (
              <option key={b} value={b}>{buildingLabel(b)}</option>
            ))}
          </select>
        </label>
        <label className="emergency-coverage-filter">
          Type
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">All types</option>
            {MARKER_TYPES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </label>
        <label className="emergency-coverage-filter emergency-coverage-filter-search">
          Search
          <span className="user-panel-search">
            <IconPlaceholder name="search-magnifier" className="user-panel-search-icon" />
            <input
              type="search"
              className="user-panel-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by label or node"
            />
          </span>
        </label>
        <label className="marker-management-check">
          <input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} />
          Only markers with problems
        </label>
      </div>

      {shown.length === 0 ? (
        <div className="signage-empty">
          <p className="signage-empty-title">No markers match</p>
        </div>
      ) : (
        <section className="signage-card" aria-label="Markers">
        <table className="emergency-coverage-table">
          <thead>
            <tr><th>Type</th><th>Label</th><th>Node</th><th>Where</th><th>Problems</th><th /></tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={`${r.nodeId}:${r.id}`}>
                <td>
                  <span className="marker-management-swatch" style={{ background: markerTypeInfo(r.type).color }} />
                  {markerTypeInfo(r.type).label}
                </td>
                <td>{r.label || <span className="field-hint">none</span>}</td>
                <td>{r.nodeName}<span className="field-hint"> {r.nodeId}</span></td>
                <td>{buildingLabel(r.building)}, {floorLabel(r.floor)}</td>
                <td>
                  {r.problems.length === 0
                    ? <span className="field-hint">None</span>
                    : r.problems.map((p) => <div key={p} className="marker-management-problem">{MARKER_PROBLEMS[p]}</div>)}
                </td>
                <td className="emergency-coverage-actions">
                  <div>
                    <button type="button" className="signage-btn" onClick={() => openInEditor(r.nodeId)}>
                      Open in editor
                    </button>
                    <button type="button" className="danger signage-btn" disabled={busyId === r.id} onClick={() => remove(r)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </section>
      )}
    </div>
  );
}
