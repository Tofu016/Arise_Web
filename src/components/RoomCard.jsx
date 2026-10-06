import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useHeldPhoto, usePreloadPhotos } from "../hooks/useHeldPhoto";
import { useToast } from "../context/ToastContext";
import { buildingLabel, floorLabel } from "../utils/constants";
import chevronDownWhite from "../assets/icons/chevron-down-white.svg";
import chevronLeftWhite from "../assets/icons/chevron-left-white.svg";
import chevronRightWhite from "../assets/icons/chevron-right-white.svg";
import locationIcon from "../assets/icons/location.svg";
import departmentIcon from "../assets/icons/department.svg";
import linkIcon from "../assets/icons/link.svg";
import linkIconWhite from "../assets/icons/link-white.svg";
import bookmarkIconWhite from "../assets/icons/bookmark-white.svg";
import bookmarkFilledIconWhite from "../assets/icons/bookmark-filled-white.svg";
import IconPlaceholder from "./IconPlaceholder";
import PhotoLightbox from "./PhotoLightbox";
import PhotoLoading from "./PhotoLoading";
import { focusPosition, isPanorama, roomPhotos } from "../utils/roomPhotos";
import { useFlatPhotoUrl, SQUARE_PREVIEW } from "../hooks/useFlatPhotoUrl";
import { Pano360Pill } from "./RoomPanorama";

// How far (as a fraction of the collapsed-to-expanded travel) a drag has to
// go before releasing it flips the sheet to the other state. Short of that
// it springs back, so a small accidental nudge never toggles it.
const SNAP_FRACTION = 0.25;
// Below this much pointer travel a press on the grab area is a tap, not a drag.
const TAP_SLOP_PX = 4;
// Horizontal travel that counts as a photo swipe rather than a tap.
const SWIPE_MIN_PX = 40;

// The desktop view's room information, as a bottom sheet over the app
// sidebar's directory. It opens collapsed to its "peek" (name, close,
// location/link/contact number, then Directions/link/call/save) so the
// directory stays usable behind it, and is dragged (or tapped)
// up to the sidebar's full height to reveal the description
// and photos below. A room opened with search's "Go To" (room.openExpanded)
// starts fully expanded instead. MainPage keys it on the room and that flag,
// so each new pick starts in its own state.
export default function RoomCard({ room, saved, onToggleSave, onClose, onGoTo, onGetDirections, onExpandedChange }) {
  const { roomName, placard, node } = room;
  const toast = useToast();

  const sheetRef = useRef(null);
  const peekRef = useRef(null);
  const dragRef = useRef(null);
  const [expanded, setExpanded] = useState(!!room.openExpanded);
  // Reported up so the state survives the card unmounting behind the directions panel.
  useEffect(() => {
    onExpandedChange?.(expanded);
  }, [expanded, onExpandedChange]);
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
      // A tap on the handle toggles; a tap anywhere else in the peek only
      // expands, so a stray tap on the open sheet never collapses it.
      if (e.target.closest(".sidebar-room-handle")) setExpanded((v) => !v);
      else setExpanded(true);
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

  const photos = roomPhotos(placard);
  // Which photo the panorama-wide viewer is showing; null = closed. Lives
  // here so closing the room panel (this card unmounting) closes it too.
  const [viewerIndex, setViewerIndex] = useState(null);
  const screen = viewerIndex != null ? document.querySelector(".main-page-screen") : null;

  // Admins may type a URL without a protocol (e.g. "example.com"). Used
  // as-is, the browser would treat that as a relative path on this site
  // rather than an external link. Only the href gets normalized; the
  // stored/displayed value stays exactly as typed.
  const linkHref = placard?.link && !/^https?:\/\//i.test(placard.link)
    ? `https://${placard.link}`
    : placard?.link;

  // This is the desktop view, where a tel: link usually has nothing to hand
  // the call to (or pops an app picker), so the call button copies the
  // number for the visitor to dial instead. The peek is user-select: none
  // for dragging, so this is also the only way to copy it.
  const copyContactNumber = async () => {
    try {
      await navigator.clipboard.writeText(placard.contactNumber);
      toast.success(`Contact number copied: ${placard.contactNumber}`);
    } catch {
      toast.error("Couldn't copy the contact number.");
    }
  };

  const locationText = node ? `${buildingLabel(node.building)} · ${floorLabel(node.floor)}` : "";

  // Rooms with no Room Edit record (placard is null) or an empty one.
  const hasInfo = !!(placard?.roomDescription || placard?.department || placard?.link || placard?.contactNumber);

  // The description starts clamped so the whole preview photo is on screen
  // without scrolling; "Show more" expands it in place and the panel's body
  // scrolls instead. The toggle only appears when the text is actually cut.
  const descriptionRef = useRef(null);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [descriptionClipped, setDescriptionClipped] = useState(false);
  useLayoutEffect(() => {
    const el = descriptionRef.current;
    if (!el) return undefined;
    const measure = () => {
      if (!descriptionOpen) setDescriptionClipped(el.scrollHeight > el.clientHeight + 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [descriptionOpen, expanded]);

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
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="6 15 12 9 18 15" />
          </svg>
        </button>

        <div className="sidebar-room-header">
          <h2 className="sidebar-room-title">{roomName}</h2>
          <button type="button" className="sidebar-room-close" onClick={onClose} title="Close" aria-label="Close">
            <IconPlaceholder name="close" className="inline-icon-img" />
          </button>
        </div>

        {(node || placard?.department || placard?.link || placard?.contactNumber) && (
          <div className="sidebar-room-contact sidebar-room-contact-truncate">
            {node && (
              <p className="sidebar-room-contact-row">
                <img src={locationIcon} alt="" className="inline-icon-img" />
                <span title={locationText}>{locationText}</span>
              </p>
            )}
            {placard?.department && (
              <p className="sidebar-room-contact-row">
                <img src={departmentIcon} alt="" className="inline-icon-img" />
                <span title={placard.department}>{placard.department}</span>
              </p>
            )}
            {placard?.link && (
              <a className="sidebar-room-contact-row" href={linkHref} target="_blank" rel="noopener noreferrer">
                <img src={linkIcon} alt="" className="inline-icon-img" />
                <span title={placard.link}>{placard.link}</span>
              </a>
            )}
            {placard?.contactNumber && (
              <p className="sidebar-room-contact-row">
                <IconPlaceholder name="call" className="inline-icon-img" />
                <span title={placard.contactNumber}>{placard.contactNumber}</span>
              </p>
            )}
          </div>
        )}

        <button type="button" className="sidebar-room-goto" onClick={onGoTo}>
          <IconPlaceholder name="location-pin" className="inline-icon-img" /> Go To
        </button>

        <div className="sidebar-room-actions">
          <button type="button" className="primary sidebar-room-directions" onClick={onGetDirections}>
            <IconPlaceholder name="directions" variant="white" className="inline-icon-img" /> Directions
          </button>
          {placard?.link && (
            <a
              className="sidebar-room-icon-btn"
              href={linkHref}
              target="_blank"
              rel="noopener noreferrer"
              title="Open link"
              aria-label="Open link in a new tab"
            >
              <img src={linkIconWhite} alt="" className="inline-icon-img" />
            </a>
          )}
          {placard?.contactNumber && (
            <button
              type="button"
              className="sidebar-room-icon-btn"
              onClick={copyContactNumber}
              title="Copy contact number"
              aria-label={`Copy contact number ${placard.contactNumber}`}
            >
              <IconPlaceholder name="call" variant="white" className="inline-icon-img" />
            </button>
          )}
          <button
            type="button"
            className="sidebar-room-icon-btn"
            onClick={onToggleSave}
            aria-pressed={saved}
            title={saved ? "Remove from Saved Directories" : "Save to Saved Directories"}
            aria-label={saved ? "Remove from Saved Directories" : "Save to Saved Directories"}
          >
            <img src={saved ? bookmarkFilledIconWhite : bookmarkIconWhite} alt="" className="inline-icon-img" />
          </button>
        </div>
      </div>

      {/* Hidden from assistive tech and the tab order while collapsed, since
          it's clipped out of view below the peek. */}
      <div className="sidebar-room-body" inert={!expanded}>
        <div className="sidebar-room-description-wrap">
          <p
            ref={descriptionRef}
            className={"sidebar-room-description" + (descriptionOpen ? " sidebar-room-description-open" : "")}
          >
            {placard?.roomDescription || (hasInfo ? "No description." : "No information.")}
          </p>
          {(descriptionClipped || descriptionOpen) && (
            <button
              type="button"
              className="sidebar-room-description-toggle"
              aria-expanded={descriptionOpen}
              onClick={() => setDescriptionOpen((v) => !v)}
            >
              {descriptionOpen ? "Show less" : "Show more"}
              <img src={chevronDownWhite} alt="" className="inline-icon-img" />
            </button>
          )}
        </div>

        <RoomPhotoCarousel photos={photos} alt={roomName} onOpen={setViewerIndex} />
      </div>

      {screen && photos.length > 0 && createPortal(
        <PhotoLightbox photos={photos} index={Math.min(viewerIndex, photos.length - 1)} onIndexChange={setViewerIndex} onClose={() => setViewerIndex(null)} alt={roomName} />,
        screen
      )}
    </div>
  );
}

// `onOpen(index)`, when given, makes the photo itself pressable (the desktop
// panel opens its viewer from it). A 360 photo shows here as a flat-looking
// view of itself with a "360°" pill over it; `onOpenPanorama(photo)`, when given,
// makes that pill a button that opens it for looking around (the kiosk, which
// has no viewer; on desktop the photo itself opens the viewer).
export function RoomPhotoCarousel({ photos, alt, onOpen, onOpenPanorama }) {
  const [index, setIndex] = useState(0);
  usePreloadPhotos(photos.map((p) => p.path));
  // The previous photo stays up (same size) while the next resolves; the
  // spinner only appears if that drags on (see .photo-loading-veil).
  const { url, path: shownPath, pending, error } = useHeldPhoto(photos[index]?.path);
  const shown = photos.find((p) => p.path === shownPath);
  const flatUrl = useFlatPhotoUrl(url, shown, SQUARE_PREVIEW);
  const multiple = photos.length > 1;

  const prev = () => setIndex((i) => (i - 1 + photos.length) % photos.length);
  const next = () => setIndex((i) => (i + 1) % photos.length);

  // Horizontal swipe flips photos. No pointer capture, so the arrows, dots and
  // the open button keep receiving their own clicks; a swipe that ends on the
  // open button has its click swallowed so it doesn't also open the viewer.
  const swipeRef = useRef(null);
  const swipedRef = useRef(false);
  const handleSwipeStart = (e) => {
    if (!multiple || (e.pointerType === "mouse" && e.button !== 0)) return;
    swipeRef.current = { x: e.clientX, y: e.clientY };
    swipedRef.current = false;
  };
  const handleSwipeEnd = (e) => {
    const start = swipeRef.current;
    swipeRef.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    swipedRef.current = true;
    if (dx < 0) next();
    else prev();
  };
  const handleClickCapture = (e) => {
    if (!swipedRef.current) return;
    swipedRef.current = false;
    e.stopPropagation();
  };

  if (photos.length === 0) return null;

  let content;
  if (!flatUrl) {
    content = (
      <div className="sidebar-room-carousel-empty">
        {error ? "Couldn't load photo." : <PhotoLoading />}
      </div>
    );
  } else {
    // Square, cropped around the focus an admin set for the photo on screen
    // (centered by default, and for a 360 photo's flattened view); the viewer
    // shows the whole picture.
    const image = (
      <img
        src={flatUrl}
        alt={alt}
        className={"sidebar-room-carousel-image photo-swap" + (pending ? " photo-dimmed" : "")}
        style={{ objectPosition: focusPosition(isPanorama(shown) ? null : shown) }}
      />
    );
    content = onOpen ? (
      <button type="button" className="sidebar-room-carousel-open" onClick={() => onOpen(index)} aria-label={`View ${alt} photo larger`}>
        {image}
      </button>
    ) : image;
  }

  return (
    <div
      className="sidebar-room-carousel"
      onPointerDown={handleSwipeStart}
      onPointerUp={handleSwipeEnd}
      onPointerCancel={() => { swipeRef.current = null; }}
      onClickCapture={handleClickCapture}
    >
      {content}
      {isPanorama(shown) && flatUrl && !pending && (
        <Pano360Pill
          className={multiple ? "pano-360-pill-above-dots" : ""}
          onClick={onOpenPanorama ? () => onOpenPanorama(shown) : undefined}
        />
      )}
      {flatUrl && pending && !error && (
        <div className="photo-loading-veil"><PhotoLoading /></div>
      )}

      {multiple && (
        <>
          <button type="button" className="photo-arrow sidebar-room-carousel-arrow sidebar-room-carousel-prev" onClick={prev} aria-label="Previous photo">
            <img src={chevronLeftWhite} alt="" className="inline-icon-img" />
          </button>
          <button type="button" className="photo-arrow sidebar-room-carousel-arrow sidebar-room-carousel-next" onClick={next} aria-label="Next photo">
            <img src={chevronRightWhite} alt="" className="inline-icon-img" />
          </button>
          <div className="sidebar-room-carousel-dots">
            {photos.map((p, i) => (
              <button
                key={p.path}
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
