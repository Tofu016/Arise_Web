import { useEffect, useRef, useState } from "react";
import { useSecurePhotoUrl } from "../hooks/useSecurePhotoUrl";
import { buildingLabel, floorLabel } from "../utils/constants";

// Three snap heights, as fractions of the viewport height — matches the
// wireframe's peek/half/full room-panel variants exactly, and mirrors real
// Google Maps' own mobile place-details sheet behavior.
const SNAP_PEEK = 0.24;
const SNAP_HALF = 0.5;
const SNAP_FULL = 0.88;
const SNAP_POINTS = [SNAP_PEEK, SNAP_HALF, SNAP_FULL];

export default function MobileRoomSheet({ room, onClose, onGetDirections, onView360 }) {
  const { roomName, node, placard } = room;
  const { url: photoUrl } = useSecurePhotoUrl(placard?.photo);

  const [snap, setSnap] = useState(SNAP_PEEK);
  const [dragging, setDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartSnap = useRef(SNAP_PEEK);

  // Reset to the compact "peek" height every time a different room opens.
  useEffect(() => {
    setSnap(SNAP_PEEK);
  }, [room]);

  const handlePointerDown = (e) => {
    setDragging(true);
    dragStartY.current = e.clientY;
    dragStartSnap.current = snap;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!dragging) return;
    const deltaY = dragStartY.current - e.clientY; // dragging up (finger moves up) = taller sheet
    const next = dragStartSnap.current + deltaY / window.innerHeight;
    setSnap(Math.min(SNAP_FULL, Math.max(0.08, next)));
  };

  const handlePointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    // Dragged well below the smallest snap point — treat as "let go of it
    // entirely" rather than snapping back, matching a real bottom-sheet's
    // dismiss-by-dragging-down gesture.
    if (snap < SNAP_PEEK - 0.1) {
      onClose();
      return;
    }
    let nearest = SNAP_POINTS[0];
    let minDist = Math.abs(snap - SNAP_POINTS[0]);
    for (const p of SNAP_POINTS) {
      const d = Math.abs(snap - p);
      if (d < minDist) {
        minDist = d;
        nearest = p;
      }
    }
    setSnap(nearest);
  };

  // Only worth showing the longer description/department text once the
  // sheet is at least roughly at the "half" height — no point cramming it
  // in while still at a quick-glance "peek" height.
  const showDetails = snap > (SNAP_PEEK + SNAP_HALF) / 2;

  return (
    <div
      className="mobile-sheet"
      style={{ height: `${snap * 100}vh`, transition: dragging ? "none" : "height 0.25s ease" }}
    >
      <div
        className="mobile-sheet-handle-area"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="mobile-sheet-handle" />
      </div>

      <div className="mobile-sheet-content">
        <div className="room-card-photo-wrap mobile-room-photo-wrap">
          {placard?.photo ? (
            photoUrl ? (
              <img src={photoUrl} alt={roomName} className="room-card-photo" />
            ) : (
              <div className="room-card-photo-placeholder">Loading photo…</div>
            )
          ) : (
            <div className="room-card-photo-placeholder">📷 No photo yet</div>
          )}
        </div>

        <div className="mobile-sheet-body">
          <div className="mobile-sheet-title-row">
            <h2 className="room-card-title">{roomName}</h2>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>

          {placard?.use && <span className="room-card-badge">{placard.use}</span>}

          {node && (
            <p className="room-card-location">
              📍 {buildingLabel(node.building)} · {floorLabel(node.floor)} · near {node.name}
            </p>
          )}

          <div className="room-card-actions">
            <button className="primary" onClick={onGetDirections}>➜ Get Directions</button>
            <button onClick={onView360}>360° View</button>
          </div>

          {showDetails && placard?.roomDescription && (
            <p className="room-card-description">{placard.roomDescription}</p>
          )}
          {showDetails && placard?.department && (
            <p className="room-card-department">
              <strong>Department:</strong> {placard.department}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
