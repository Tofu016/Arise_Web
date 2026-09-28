import { useEffect, useRef, useState } from "react";
import { useNodes } from "../../hooks/useNodes";
import { useTourStops } from "../../hooks/useTourStops";
import { usePhotos } from "../../hooks/usePhotos";
import { useSecurePhotoUrl } from "../../hooks/useSecurePhotoUrl";

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

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Its own component so useSecurePhotoUrl (a hook) can be called once
// per card, since hooks can't be called inside a loop.
function PhotoCard({ photo, onDelete, deleting }) {
  // "Photos" scans every photo on disk of every kind at once — with hundreds
  // of them, fetching every card's full-resolution image on mount would fire
  // that many multi-MB fetch+decodes simultaneously. A card doesn't request
  // its photo until it's actually scrolled into view, and asks for a small
  // downscaled copy rather than the original since it only ever displays it
  // as a thumbnail (see NodeFlowchartPage/PhotoFlowNode for the same pattern).
  const [visible, setVisible] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (visible) return;
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  const { url } = useSecurePhotoUrl(visible ? photo.path : null, { thumbnail: true });

  const handleDelete = () => {
    if (!window.confirm(`Delete "${photo.path}" permanently? This can't be undone.`)) return;
    onDelete(photo.path);
  };

  return (
    <div className="photo-gallery-card" ref={containerRef}>
      {url ? (
        <img src={url} alt={photo.path} className="photo-gallery-thumb" />
      ) : (
        <div className="photo-gallery-thumb-placeholder" />
      )}
      <div className="photo-gallery-card-body">
        <span className={"photo-gallery-badge" + (photo.in_use ? " photo-gallery-badge-inuse" : " photo-gallery-badge-orphaned")}>
          {photo.in_use ? "In use" : "Orphaned"}
        </span>
        <span className="photo-gallery-path" title={photo.path}>{photo.path}</span>
        <span className="field-hint">{formatBytes(photo.size_bytes)}</span>
        {!photo.in_use && (
          <button type="button" className="photo-gallery-delete" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete"}
          </button>
        )}
      </div>
    </div>
  );
}

// Merged page: the Photo Coverage function (which nodes/tour stops still
// need a photo uploaded) on top, and the Photos function (every photo on
// disk, in-use/orphaned, with delete) below it, keeping its own "Photos"
// title as a sub-section. Combined because both pages exist to answer the
// same underlying question — "what's going on with our photos" — from two
// different angles (missing vs. everything-that-exists), so admins no
// longer have to jump between two separate sidebar entries for it.
export default function PhotoCoverageAdminPage() {
  const { nodes } = useNodes();
  const { stops } = useTourStops();
  const { photos, loading, deletePhoto } = usePhotos();
  const [filter, setFilter] = useState("all");
  const [deletingPath, setDeletingPath] = useState(null);
  const [error, setError] = useState("");

  const nodesWithPhoto = nodes.filter((n) => n.photo);
  const nodesMissing = nodes.filter((n) => !n.photo);
  const stopsWithPhoto = stops.filter((s) => s.photo);
  const stopsMissing = stops.filter((s) => !s.photo);

  const handleDelete = async (path) => {
    setError("");
    setDeletingPath(path);
    try {
      await deletePhoto(path);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingPath(null);
    }
  };

  const orphanedCount = photos.filter((p) => !p.in_use).length;
  const filtered = photos.filter((p) => {
    if (filter === "inuse") return p.in_use;
    if (filter === "orphaned") return !p.in_use;
    return true;
  });

  return (
    <div className="photo-coverage-page">
      <h2 className="admin-page-heading">Photo Coverage</h2>
      <p className="field-hint">
        Which nodes and tour stops still need a 360° photo uploaded. A node or stop with no photo has nothing
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

      <h2 className="admin-page-heading">
        Photos
        {orphanedCount > 0 && <span className="badge-count">{orphanedCount} orphaned</span>}
      </h2>
      <p className="field-hint">
        Every photo uploaded anywhere in the system: node panoramas, room photos, tour stops, section covers,
        and marker photos, scanned directly from disk and checked against what's actually referenced.
      </p>

      <div className="photo-gallery-filter-row">
        <button type="button" className={filter === "all" ? "primary" : ""} onClick={() => setFilter("all")}>
          All ({photos.length})
        </button>
        <button type="button" className={filter === "inuse" ? "primary" : ""} onClick={() => setFilter("inuse")}>
          In use ({photos.length - orphanedCount})
        </button>
        <button type="button" className={filter === "orphaned" ? "primary" : ""} onClick={() => setFilter("orphaned")}>
          Orphaned ({orphanedCount})
        </button>
      </div>

      {error && (
        <div className="error-box">
          <p>{error}</p>
        </div>
      )}

      {loading && <p className="empty-hint">Loading…</p>}
      {!loading && filtered.length === 0 && <p className="empty-hint">No photos match this filter.</p>}

      <div className="photo-gallery-grid">
        {filtered.map((photo) => (
          <PhotoCard
            key={photo.path}
            photo={photo}
            onDelete={handleDelete}
            deleting={deletingPath === photo.path}
          />
        ))}
      </div>
    </div>
  );
}
