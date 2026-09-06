import { useEffect, useMemo, useState } from "react";
import { buildingLabel, floorLabel, typeLabel } from "../utils/constants";
import { useSecurePhotoUrl } from "../hooks/useSecurePhotoUrl";
import PanoramaNav from "./PanoramaNav";

// Entrances first (so the tour genuinely "starts at the entrance" per building),
// then everything else in a stable building/floor/id order.
function sortForTour(nodes) {
  const rank = (n) => (n.type === "entrance" ? 0 : 1);
  return [...nodes].sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (a.building !== b.building) return a.building.localeCompare(b.building);
    if (a.floor !== b.floor) return a.floor - b.floor;
    return a.id.localeCompare(b.id);
  });
}

export default function PreviewTour({ nodes, startNodeId, onClose }) {
  const sorted = useMemo(() => sortForTour(nodes), [nodes]);
  const [index, setIndex] = useState(() => {
    if (startNodeId) {
      const i = sorted.findIndex((n) => n.id === startNodeId);
      if (i !== -1) return i;
    }
    return 0;
  });
  const [photoMissing, setPhotoMissing] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  const current = sorted[index];
  const { url: securePhotoUrl, error: secureError } = useSecurePhotoUrl(current?.photo);

  // Reset load state whenever we land on a different node.
  useEffect(() => {
    setPhotoMissing(false);
    setShowWarning(false);
  }, [index]);

  // The authenticated fetch itself can fail (bad path, rules mismatch) —
  // treat that the same as a texture load failure.
  useEffect(() => {
    if (secureError) {
      setPhotoMissing(true);
      setShowWarning(true);
    }
  }, [secureError]);

  if (sorted.length === 0) {
    return (
      <div className="modal-overlay">
        <div className="modal preview-modal">
          <p>No nodes to preview yet.</p>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  const goNext = () => setIndex((i) => Math.min(i + 1, sorted.length - 1));
  const goPrev = () => setIndex((i) => Math.max(i - 1, 0));

  const handleImgError = () => {
    setPhotoMissing(true);
    setShowWarning(true);
  };

  return (
    <div className="modal-overlay">
      <div className="modal preview-modal">
        <div className="preview-header">
          <h3>Node Preview — {index + 1} / {sorted.length}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="preview-screen">
          {current.photo && !photoMissing ? (
            securePhotoUrl ? (
              <PanoramaNav
                key={current.id}
                url={securePhotoUrl}
                hotspots={[]}
                markers={[]}
                onNavigate={() => {}}
                onError={handleImgError}
              />
            ) : (
              <div className="preview-screen-empty">Loading photo…</div>
            )
          ) : (
            <div className="preview-screen-empty">No photo to display</div>
          )}
        </div>
        <p className="preview-hint">Left-click and drag to look around</p>

        <div className="preview-meta">
          <div className="preview-name">{current.name}</div>
          <div className="preview-sub">
            {current.id} · {buildingLabel(current.building)} · {floorLabel(current.floor)} · {typeLabel(current.type)}
          </div>
          <div className="preview-sub">
            {current.neighbors?.length ? `${current.neighbors.length} linked node(s)` : "Not linked to any node yet"}
          </div>
        </div>

        <div className="preview-controls">
          <button onClick={goPrev} disabled={index === 0}>← Prev</button>
          <button onClick={goNext} disabled={index === sorted.length - 1}>Next →</button>
        </div>
      </div>

      {showWarning && (
        <div className="modal-overlay warning-overlay">
          <div className="modal warning-modal">
            <h4>Missing photo</h4>
            <p>
              No photo found for <strong>{current.name}</strong>.<br />
              {current.photo
                ? <>Its photo reference (<code>{current.photo}</code>) didn't load — the file may have been moved, deleted, or never actually uploaded to Storage.</>
                : "This node has no photo set yet."}
            </p>
            <button className="primary" onClick={() => setShowWarning(false)}>OK, continue</button>
          </div>
        </div>
      )}
    </div>
  );
}
