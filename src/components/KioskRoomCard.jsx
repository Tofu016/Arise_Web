import { useSecurePhotoUrl } from "../hooks/useSecurePhotoUrl";
import { buildingLabel, floorLabel } from "../utils/constants";
import { KIOSK_TOP_INSET, KIOSK_PANORAMA_FRACTION } from "../utils/kioskLayout";

// The kiosk view's room information card. Shares the KioskDialog footprint
// (the top half of the panorama band, closed by a centered ✕ underneath) so
// it sits at eye level instead of sliding up from shin height, but needs no
// keyboard, so it's a photo | details split:
//
//   ┌──────────┬────────────────────┐
//   │          │ Room name          │
//   │  photo   │ badge · location   │
//   │          │ description, dept  │
//   │          │ [Directions] [360°]│
//   └──────────┴────────────────────┘
//                      (  ✕  )
//
// There's deliberately no scrim: the lower half of the panorama stays live.
export default function KioskRoomCard({ room, onClose, onGetDirections, onView360 }) {
  const { roomName, node, placard } = room;
  const { url: photoUrl } = useSecurePhotoUrl(placard?.photo);

  return (
    <div
      className="kiosk-dialog-layer"
      style={{
        top: `${KIOSK_TOP_INSET * 100}%`,
        "--kiosk-grid-height": `calc(${(KIOSK_PANORAMA_FRACTION / 2) * 100}vh - var(--kiosk-dialog-gap))`,
      }}
    >
      <div className="kiosk-room-card" role="dialog" aria-label={roomName}>
        <div className="kiosk-room-card-photo">
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

        <div className="kiosk-room-card-body">
          <div className="kiosk-room-card-text">
            <h2 className="room-card-title">{roomName}</h2>
            {placard?.use && <span className="room-card-badge">{placard.use}</span>}
            {node && (
              <p className="room-card-location">
                📍 {buildingLabel(node.building)} · {floorLabel(node.floor)} · near {node.name}
              </p>
            )}
            {placard?.roomDescription && (
              <p className="room-card-description">{placard.roomDescription}</p>
            )}
            {placard?.department && (
              <p className="room-card-department">
                <strong>Department:</strong> {placard.department}
              </p>
            )}
          </div>

          <div className="room-card-actions">
            <button className="primary" onClick={onGetDirections}>➜ Get Directions</button>
            <button onClick={onView360}>360° View</button>
          </div>
        </div>
      </div>
      <button type="button" className="kiosk-dialog-close" onClick={onClose} aria-label="Close">
        ✕
      </button>
    </div>
  );
}
