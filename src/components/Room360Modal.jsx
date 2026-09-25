import { useSecurePhotoUrl } from "../hooks/useSecurePhotoUrl";
import PanoramaNav from "./PanoramaNav";

// Shows a room's OWN photo360 (set via the "360° room photo" field in Room
// Edit) as a standalone, draggable 360° sphere — deliberately not part of
// the navigable node graph at all, so no hotspots/markers, no
// onNavigate/onPlaceAngle. Reuses PanoramaNav purely for its proven
// sphere-rendering, not its navigation machinery.
export default function Room360Modal({ roomName, photo360, onClose }) {
  const { url, error } = useSecurePhotoUrl(photo360);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="preview-header">
          <h3>360° View: {roomName}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="preview-screen">
          {url ? (
            <PanoramaNav url={url} hotspots={[]} markers={[]} onNavigate={() => {}} onError={() => {}} />
          ) : error ? (
            <span className="preview-screen-empty">Couldn't load this photo.</span>
          ) : (
            <span className="preview-screen-empty">Loading…</span>
          )}
        </div>
        <p className="preview-hint">Click and drag to look around</p>
      </div>
    </div>
  );
}
