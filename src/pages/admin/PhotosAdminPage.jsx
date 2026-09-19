import { useState } from "react";
import { usePhotos } from "../../hooks/usePhotos";
import { useSecurePhotoUrl } from "../../hooks/useSecurePhotoUrl";

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Its own component so useSecurePhotoUrl (a hook) can be called once
// per card, since hooks can't be called inside a loop.
function PhotoCard({ photo, onDelete, deleting }) {
  const { url } = useSecurePhotoUrl(photo.path);

  const handleDelete = () => {
    if (!window.confirm(`Delete "${photo.path}" permanently? This can't be undone.`)) return;
    onDelete(photo.path);
  };

  return (
    <div className="photo-gallery-card">
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

// Covers every photo type in the system — node panoramas, room
// photos/360s, tour stop panoramas, tour section covers, tour marker
// photos — all scanned directly off disk by Photos_API/getAll, cross-
// referenced against every table that can reference a photo. In-use
// items show no delete button at all; the backend's own delete()
// independently re-checks in-use status too, from a fresh database
// read, rather than trusting whatever this page last displayed.
export default function PhotosAdminPage() {
  const { photos, loading, deletePhoto } = usePhotos();
  const [filter, setFilter] = useState("all");
  const [deletingPath, setDeletingPath] = useState(null);
  const [error, setError] = useState("");

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
    <div className="photo-gallery-page">
      <h2 className="admin-page-heading">
        Photos
        {orphanedCount > 0 && <span className="badge-count">{orphanedCount} orphaned</span>}
      </h2>
      <p className="field-hint">
        Every photo uploaded anywhere in the system — node panoramas, room photos, tour stops, section covers,
        and marker photos — scanned directly from disk and checked against what's actually referenced.
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
