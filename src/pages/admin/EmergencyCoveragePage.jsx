import { useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { auditEmergencyCoverage, findEvacuationRoute } from "../../utils/evacuation";
import { buildingLabel, EMERGENCY_DESTINATION_INDOOR_TYPES, floorLabel, typeLabel } from "../../utils/constants";

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

const placeText = (n) => `${buildingLabel(n.building)}, ${floorLabel(Number(n.floor))}`;

// How well the node graph, as authored, actually gets a visitor out when
// they tap Nearest Exit. It runs the same routing the public viewer does
// (utils/evacuation.js) from every node, so what is listed here is exactly
// what a visitor standing there would be told.
export default function EmergencyCoveragePage() {
  const { nodes, setSelectedNodeId } = useOutletContext();
  const navigate = useNavigate();
  const [building, setBuilding] = useState("all");
  const [previewId, setPreviewId] = useState("");

  const audit = useMemo(() => auditEmergencyCoverage(nodes), [nodes]);
  const byId = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);
  const buildings = useMemo(() => [...new Set(nodes.map((n) => n.building))].sort(), [nodes]);

  const inScope = (n) => building === "all" || n.building === building;
  const problems = audit.entries.filter((e) => inScope(e) && (e.status === "none" || e.status === "ascends"));
  const destinations = audit.destinationPoints.filter(inScope);
  const indoorRisk = destinations.filter((d) => EMERGENCY_DESTINATION_INDOOR_TYPES.includes(d.type));
  const preview = previewId ? findEvacuationRoute(nodes, previewId) : null;

  const openInEditor = (id) => {
    setSelectedNodeId(id);
    navigate("/admin/node-editor");
  };

  return (
    <div className="emergency-coverage-page">
      <header>
        <h2 className="admin-page-heading">Emergency Coverage</h2>
        <p className="signage-page-intro">
          Checks that Nearest Exit works from every node. A visitor is routed to the nearest Emergency Exit
          Destination Point: an Open Area, Parking, Lobby, Entrance or Fire Exit node on Floor 1 or Underground
          that you ticked in the Node Editor. Nothing counts unless ticked. Routes never use elevators and never
          climb above Floor 1 (or the visitor's own floor) unless no other way exists.
        </p>
      </header>

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
      </div>

      <div className="emergency-coverage-summary">
        <SummaryCard label="Destination points" count={destinations.length} />
        <SummaryCard label="Route stays level or down" count={audit.entries.filter((e) => inScope(e) && (e.status === "ok" || e.status === "destination")).length} />
        <SummaryCard label="Route must go up" count={problems.filter((e) => e.status === "ascends").length} warn />
        <SummaryCard label="No route" count={problems.filter((e) => e.status === "none").length} warn />
      </div>

      {audit.buildingsWithoutDestination.filter((b) => building === "all" || b === building).length > 0 && (
        <div className="emergency-coverage-callout emergency-coverage-callout-bad">
          <strong>No destination point at all:</strong>{" "}
          {audit.buildingsWithoutDestination.filter((b) => building === "all" || b === building).map(buildingLabel).join(", ")}.
          Nearest Exit has nowhere to send anyone in these buildings. Tick the ground-floor exits that are
          really out of danger.
        </div>
      )}

      {indoorRisk.length > 0 && (
        <div className="emergency-coverage-callout">
          <strong>Confirm these are really out of danger:</strong>{" "}
          {indoorRisk.map((n) => `${n.id} (${typeLabel(n.type)})`).join(", ")}.
          A Lobby or Entrance can be an indoor space, or open into one. Visitors are told they have reached
          their exit at each of these.
        </div>
      )}

      {audit.misflagged.filter(inScope).length > 0 && (
        <div className="emergency-coverage-callout emergency-coverage-callout-bad">
          <strong>Tick ignored:</strong> these nodes are ticked but cannot count, because of their type or
          because they are above Floor 1:{" "}
          {audit.misflagged.filter(inScope).map((n) => n.id).join(", ")}.
        </div>
      )}

      <section className="signage-card">
      <div className="signage-card-head"><h3>Nodes that need attention</h3></div>
      {problems.length === 0 ? (
        <p className="field-hint">Every node in this view has a route that stays level or goes down.</p>
      ) : (
        <table className="emergency-coverage-table">
          <thead>
            <tr><th>Node</th><th>Where</th><th>Problem</th><th /></tr>
          </thead>
          <tbody>
            {problems.map((e) => (
              <tr key={e.id}>
                <td>{e.name}<span className="field-hint"> {e.id}</span></td>
                <td>{placeText(e)}</td>
                <td>
                  {e.status === "none"
                    ? "No route to any destination point."
                    : `Only route goes up first (${e.hops} stops to ${byId[e.destinationId]?.name ?? e.destinationId}).`}
                </td>
                <td className="emergency-coverage-actions"><button type="button" className="signage-btn" onClick={() => openInEditor(e.id)}>Open in Node Editor</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      </section>

      <section className="signage-card">
      <div className="signage-card-head"><h3>Emergency Exit Destination Points</h3></div>
      {destinations.length === 0 ? (
        <p className="field-hint">None in this view.</p>
      ) : (
        <table className="emergency-coverage-table">
          <thead>
            <tr><th>Node</th><th>Where</th><th>Type</th><th /></tr>
          </thead>
          <tbody>
            {destinations.map((s) => (
              <tr key={s.id}>
                <td>{s.name}<span className="field-hint"> {s.id}</span></td>
                <td>{placeText(s)}</td>
                <td>{typeLabel(s.type)}</td>
                <td className="emergency-coverage-actions"><button type="button" className="signage-btn" onClick={() => openInEditor(s.id)}>Open in Node Editor</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      </section>

      <section className="signage-card">
      <div className="signage-card-head"><h3>Preview a route</h3></div>
      <label className="emergency-coverage-filter">
        Starting node
        <select value={previewId} onChange={(e) => setPreviewId(e.target.value)}>
          <option value="">Pick a node</option>
          {nodes.filter(inScope).map((n) => (
            <option key={n.id} value={n.id}>{n.name} ({n.id})</option>
          ))}
        </select>
      </label>
      {previewId && !preview && <p className="directions-error">No route to any destination point from here.</p>}
      {preview && (
        <div className="emergency-coverage-preview">
          <ol>
            {preview.path.map((id) => (
              <li key={id}>{byId[id].name} <span className="field-hint">{floorLabel(Number(byId[id].floor))}</span></li>
            ))}
          </ol>
          {preview.ascends && <p className="directions-error">This route goes up first: no way down exists from here.</p>}
        </div>
      )}
      </section>
    </div>
  );
}
