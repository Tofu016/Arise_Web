import { useState } from "react";
import { useSecurePhotoUrl } from "../hooks/useSecurePhotoUrl";
import directionsIconWhite from "../assets/icons/directions-white.svg";
import chevronLeftWhite from "../assets/icons/chevron-left-white.svg";
import chevronRightWhite from "../assets/icons/chevron-right-white.svg";
import placeholderIcon from "../assets/icons/icon-placeholder.svg";
import IconPlaceholder from "./IconPlaceholder";

// The desktop view's room information, rendered as a mode of the app sidebar
// itself (MainPage adds .app-sidebar-room to recolor the whole sidebar)
// rather than as a separate card stacked on top of it. The photo carousel
// takes whatever is left of the sidebar's height below the text block.
export default function RoomCard({ room, onClose, onGetDirections }) {
  const { roomName, placard } = room;

  // Placards only store a single photo today (placard_dialogs.photo_path);
  // `photos` is read first so a future multi-photo table drops straight in.
  let photos = [];
  if (placard?.photos?.length) photos = placard.photos;
  else if (placard?.photo) photos = [placard.photo];

  // Admins may type a URL without a protocol (e.g. "example.com"). Used
  // as-is, the browser would treat that as a relative path on this site
  // rather than an external link. Only the href gets normalized; the
  // stored/displayed value stays exactly as typed.
  const linkHref = placard?.link && !/^https?:\/\//i.test(placard.link)
    ? `https://${placard.link}`
    : placard?.link;

  // Rooms with no Room Edit record (placard is null) or an empty one.
  const hasInfo = !!(placard?.use || placard?.roomDescription || placard?.link || placard?.department);

  return (
    <div className="sidebar-room">
      <div className="sidebar-room-header">
        <h2 className="sidebar-room-title">{roomName}</h2>
        <button type="button" className="sidebar-room-close" onClick={onClose} title="Close" aria-label="Close">
          <IconPlaceholder name="close" variant="white" className="inline-icon-img" />
        </button>
      </div>

      {placard?.use && <span className="sidebar-room-badge">{placard.use}</span>}

      <p className="sidebar-room-description">
        {placard?.roomDescription || (hasInfo ? "No description." : "No information.")}
      </p>

      <div className="sidebar-room-actions">
        <button type="button" className="primary sidebar-room-directions" onClick={onGetDirections}>
          <img src={directionsIconWhite} alt="" className="inline-icon-img" /> Directions
        </button>
      </div>

      {placard?.link && (
        <a className="sidebar-room-link" href={linkHref} target="_blank" rel="noopener noreferrer">
          <IconPlaceholder name="link-chain" variant="white" /> {placard.link}
        </a>
      )}

      {placard?.department && (
        <p className="sidebar-room-department">
          <strong>Department:</strong> {placard.department}
        </p>
      )}

      {/* Keyed on the room so switching rooms restarts at the first photo
          instead of carrying a stale index into a shorter list. */}
      <RoomPhotoCarousel key={roomName} photos={photos} alt={roomName} />
    </div>
  );
}

function RoomPhotoCarousel({ photos, alt }) {
  const [index, setIndex] = useState(0);
  const { url } = useSecurePhotoUrl(photos[index]);
  const multiple = photos.length > 1;

  const prev = () => setIndex((i) => (i - 1 + photos.length) % photos.length);
  const next = () => setIndex((i) => (i + 1) % photos.length);

  return (
    <div className="sidebar-room-carousel">
      {photos.length === 0 ? (
        <div className="sidebar-room-carousel-placeholder">
          <img src={placeholderIcon} alt="No photo" />
        </div>
      ) : url ? (
        <img src={url} alt={alt} className="sidebar-room-carousel-image" />
      ) : (
        <div className="sidebar-room-carousel-empty">Loading photo…</div>
      )}

      {multiple && (
        <>
          <button type="button" className="sidebar-room-carousel-arrow sidebar-room-carousel-prev" onClick={prev} aria-label="Previous photo">
            <img src={chevronLeftWhite} alt="" className="inline-icon-img" />
          </button>
          <button type="button" className="sidebar-room-carousel-arrow sidebar-room-carousel-next" onClick={next} aria-label="Next photo">
            <img src={chevronRightWhite} alt="" className="inline-icon-img" />
          </button>
          <div className="sidebar-room-carousel-dots">
            {photos.map((p, i) => (
              <button
                key={p}
                type="button"
                className={`sidebar-room-carousel-dot ${i === index ? "sidebar-room-carousel-dot-active" : ""}`}
                onClick={() => setIndex(i)}
                aria-label={`Photo ${i + 1} of ${photos.length}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
