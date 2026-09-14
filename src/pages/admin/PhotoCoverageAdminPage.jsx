import { useNodes } from "../../hooks/useNodes";
import { useTourStops } from "../../hooks/useTourStops";

function CoverageSummary({ label, total, withPhoto }) {
  const missing = total - withPhoto;
  const pct = total > 0 ? Math.round((withPhoto / total) * 100) : 100;
  return (
    <div className="photo-coverage-summary-card">
      <span className="photo-coverage-summary-label">{label}</span>
      <span className="photo-coverage-summary-count">
        {withPhoto} / {total}
      </span>
      <span className={"photo-coverage-summary-pct" + (missing > 0 ? " photo-coverage-summary-pct-warn" : "")}>
        {pct}% have a photo
      </span>
    </div>
  );
}

// Read-only — no new backend endpoint at all, this is purely a computed
// view over data useNodes()/useTourStops() already fetch for their own
// editor pages. Each hook is called directly here rather than shared
// through AdminLayout, matching every other admin page's own pattern
// of independently calling whatever data it needs.
export default function PhotoCoverageAdminPage() {
  const { nodes } = useNodes();
  const { stops } = useTourStops();

  const nodesWithPhoto = nodes.filter((n) => n.photo);
  const nodesMissing = nodes.filter((n) => !n.photo);
  const stopsWithPhoto = stops.filter((s) => s.photo);
  const stopsMissing = stops.filter((s) => !s.photo);

  return (
    <div className="photo-coverage-page">
      <h2 className="admin-page-heading">Photo Coverage</h2>
      <p className="field-hint">
        Which nodes and tour stops still need a 360° photo uploaded — a node or stop with no photo has nothing
        for a visitor to actually see there.
      </p>

      <div className="photo-coverage-summary-row">
        <CoverageSummary label="Nodes" total={nodes.length} withPhoto={nodesWithPhoto.length} />
        <CoverageSummary label="Tour Stops" total={stops.length} withPhoto={stopsWithPhoto.length} />
      </div>

      <h3 className="photo-coverage-section-heading">Nodes missing a photo</h3>
      {nodesMissing.length === 0 ? (
        <p className="empty-hint">Every node has a photo. ✓</p>
      ) : (
        <div className="users-list">
          {nodesMissing.map((n) => (
            <div key={n.id} className="users-row">
              <div className="users-row-main">
                <span className="users-row-name">{n.name || n.id}</span>
                <span className="field-hint">
                  {n.id} · {n.building?.toUpperCase()} · Floor {n.floor}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <h3 className="photo-coverage-section-heading">Tour stops missing a photo</h3>
      {stopsMissing.length === 0 ? (
        <p className="empty-hint">Every tour stop has a photo. ✓</p>
      ) : (
        <div className="users-list">
          {stopsMissing.map((s) => (
            <div key={s.id} className="users-row">
              <div className="users-row-main">
                <span className="users-row-name">{s.name || s.id}</span>
                <span className="field-hint">{s.id}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
