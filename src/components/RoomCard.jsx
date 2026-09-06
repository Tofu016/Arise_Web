import { useSecurePhotoUrl } from "../hooks/useSecurePhotoUrl";
import { buildingLabel, floorLabel } from "../utils/constants";

export default function RoomCard({ room, onClose, onGetDirections, onView360 }) {
  const { roomName, node, placard } = room;
  const { url: photoUrl } = useSecurePhotoUrl(placard?.photo);

  // Admins may type a URL without a protocol (e.g. "example.com") — used
  // as-is, the browser would treat that as a relative path on this site
  // rather than an external link. Only the href gets normalized; the
  // stored/displayed value stays exactly as typed.
  const linkHref = placard?.link && !/^https?:\/\//i.test(placard.link)
    ? `https://${placard.link}`
    : placard?.link;

  return (
    <div className="room-card">
      <div className="room-card-photo-wrap">
        {placard?.photo ? (
          photoUrl ? (
            <img src={photoUrl} alt={roomName} className="room-card-photo" />
          ) : (
            <div className="room-card-photo-placeholder">Loading photo…</div>
          )
        ) : (
          <div className="room-card-photo-placeholder">📷 No photo yet</div>
        )}
        <button className="room-card-close" onClick={onClose} title="Close">✕</button>
      </div>

      <div className="room-card-body">
        <h2 className="room-card-title">{roomName}</h2>

        {placard?.use && <span className="room-card-badge">{placard.use}</span>}

        {node && (
          <p className="room-card-location">
            📍 {buildingLabel(node.building)} · {floorLabel(node.floor)} · near {node.name}
          </p>
        )}

        <div className="room-card-actions">
          <button className="primary" onClick={onGetDirections}>➜ Get Directions</button>
          <button onClick={onView360} disabled={!placard?.photo360} title={!placard?.photo360 ? "No 360° photo set for this room yet" : undefined}>
            360° View
          </button>
        </div>

        {placard?.roomDescription && (
          <p className="room-card-description">{placard.roomDescription}</p>
        )}

        {placard?.link && (
          <a
            className="room-card-link"
            href={linkHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            🔗 {placard.link}
          </a>
        )}

        {placard?.department && (
          <p className="room-card-department">
            <strong>Department:</strong> {placard.department}
          </p>
        )}
      </div>
    </div>
  );
}
