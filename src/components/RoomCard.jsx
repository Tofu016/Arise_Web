import { useLayoutEffect, useRef, useState } from "react";
import { useSecurePhotoUrl } from "../hooks/useSecurePhotoUrl";
import { buildingLabel, floorLabel } from "../utils/constants";
import directionsIconWhite from "../assets/icons/directions-white.svg";
import chevronLeftWhite from "../assets/icons/chevron-left-white.svg";
import chevronRightWhite from "../assets/icons/chevron-right-white.svg";
import placeholderIcon from "../assets/icons/icon-placeholder.svg";
import locationIcon from "../assets/icons/location.svg";
import IconPlaceholder from "./IconPlaceholder";

// How far (as a fraction of the collapsed-to-expanded travel) a drag has to
// go before releasing it flips the sheet to the other state. Short of that
// it springs back, so a small accidental nudge never toggles it.
const SNAP_FRACTION = 0.25;
// Below this much pointer travel a press on the grab area is a tap, not a drag.
const TAP_SLOP_PX = 4;

// The desktop view's room information, as a bottom sheet over the app
// sidebar's directory. It opens collapsed to its "peek" (name, close,
// location, Directions) so the directory stays usable behind it, and is
// dragged (or its handle tapped) up to the sidebar's full height to reveal
// the description, link, department, and photos below. MainPage keys it on
// the room, so picking another room always starts collapsed again.
export default function RoomCard({ room, onClose, onGetDirections }) {
  const { roomName, placard, node } = room;

  const sheetRef = useRef(null);
  const peekRef = useRef(null);
  const dragRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [peekHeight, setPeekHeight] = useState(null);
  // The sheet's live height while a drag is in progress; null otherwise, so
  // the snapped states come from CSS and animate.
  const [dragHeight, setDragHeight] = useState(null);

  // The peek's height depends on how the room name wraps, so it's measured
  // rather than hardcoded, and re-measured if the sidebar resizes.
  useLayoutEffect(() => {
    const peek = peekRef.current;
    if (!peek) return undefined;
    const measure = () => setPeekHeight(peek.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(peek);
    return () => observer.disconnect();
  }, []);

  const handlePointerDown = (e) => {
    // The close/Directions buttons stay plain buttons; only the handle and
    // the non-interactive parts of the peek start a drag.
    if (e.button !== 0 || e.target.closest("a, button:not(.sidebar-room-handle)")) return;
    const sheet = sheetRef.current;
    dragRef.current = {
      startY: e.clientY,
      startHeight: sheet.offsetHeight,
      maxHeight: sheet.parentElement.clientHeight,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.abs(dy) < TAP_SLOP_PX) return;
    drag.moved = true;
    const min = peekHeight ?? 0;
    setDragHeight(Math.min(drag.maxHeight, Math.max(min, drag.startHeight - dy)));
  };

  const handlePointerUp = (e) => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (!drag.moved) {
      // A tap on the handle toggles; a tap anywhere else in the peek does nothing.
      if (e.target.closest(".sidebar-room-handle")) setExpanded((v) => !v);
      return;
    }
    const min = peekHeight ?? 0;
    const travel = Math.max(1, drag.maxHeight - min);
    const progress = ((dragHeight ?? drag.startHeight) - min) / travel;
    setExpanded(expanded ? progress > 1 - SNAP_FRACTION : progress > SNAP_FRACTION);
    setDragHeight(null);
  };

  let height;
  if (dragHeight != null) height = dragHeight;
  else if (expanded) height = "100%";
  else if (peekHeight != null) height = peekHeight;

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
    <div
      ref={sheetRef}
      className={
        "sidebar-room" +
        (expanded ? " sidebar-room-expanded" : "") +
        (dragHeight != null ? " sidebar-room-dragging" : "")
      }
      style={height != null ? { height } : undefined}
    >
      <div
        ref={peekRef}
        className="sidebar-room-peek"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <button
          type="button"
          className="sidebar-room-handle"
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse room details" : "Expand room details"}
        />

        <div className="sidebar-room-header">
          <h2 className="sidebar-room-title">{roomName}</h2>
          <button type="button" className="sidebar-room-close" onClick={onClose} title="Close" aria-label="Close">
            <IconPlaceholder name="close" variant="white" className="inline-icon-img" />
          </button>
        </div>

        {node && (
          <p className="sidebar-room-location">
            <img src={locationIcon} alt="" className="inline-icon-img" /> {buildingLabel(node.building)} &middot; {floorLabel(node.floor)}
          </p>
        )}

        <div className="sidebar-room-actions">
          <button type="button" className="primary sidebar-room-directions" onClick={onGetDirections}>
            <img src={directionsIconWhite} alt="" className="inline-icon-img" /> Directions
          </button>
        </div>
      </div>

      {/* Hidden from assistive tech and the tab order while collapsed, since
          it's clipped out of view below the peek. */}
      <div className="sidebar-room-body" inert={!expanded}>
        {placard?.use && <span className="sidebar-room-badge">{placard.use}</span>}

        <p className="sidebar-room-description">
          {placard?.roomDescription || (hasInfo ? "No description." : "No information.")}
        </p>

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

        <RoomPhotoCarousel photos={photos} alt={roomName} />
      </div>
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
