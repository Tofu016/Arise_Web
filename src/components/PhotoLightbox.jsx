import { useEffect, useState } from "react";
import { useSecurePhotoUrl } from "../hooks/useSecurePhotoUrl";
import { useHeldPhoto } from "../hooks/useHeldPhoto";
import { useFlatPhotoUrl, STRIP_PREVIEW } from "../hooks/useFlatPhotoUrl";
import { isPanorama } from "../utils/roomPhotos";
import PhotoLoading from "./PhotoLoading";
import PanoramaPhoto, { Pano360Pill } from "./RoomPanorama";
import IconPlaceholder from "./IconPlaceholder";
import chevronLeftWhite from "../assets/icons/chevron-left-white.svg";
import chevronRightWhite from "../assets/icons/chevron-right-white.svg";

function Thumb({ photo, active, label, onClick }) {
  const { url: loaded } = useSecurePhotoUrl(photo.path, { cached: true });
  const url = useFlatPhotoUrl(loaded, photo, STRIP_PREVIEW);
  return (
    <button
      type="button"
      className={"photo-lightbox-thumb" + (active ? " photo-lightbox-thumb-active" : "")}
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "true" : undefined}
    >
      {url && <img src={url} alt="" />}
    </button>
  );
}

// A room's photos over the dimmed panorama: the picked photo centered with
// previous/next arrows, and a clickable strip of previews below. A 360 photo
// is dragged to look around, with a "360°" pill and, the first time one is
// shown here, a hand animation saying so. Rendered
// into .main-page-screen by RoomCard, so it dims only the panorama and goes
// away with the room panel. A press on the dimmed area (or Escape) closes it.
// `closeButton` (Mobile web layout) adds a close button just above the
// picture's top right corner as well, since a phone has no Escape key and an
// empty-looking area is not an obvious way out.
export default function PhotoLightbox({ photos, index, onIndexChange, onClose, alt, closeButton = false }) {
  const photo = photos[index];
  const panorama = isPanorama(photo);
  const { url, pending, error } = useHeldPhoto(photo.path);
  const multiple = photos.length > 1;
  const [hintPlayed, setHintPlayed] = useState(false);

  const prev = () => onIndexChange((index - 1 + photos.length) % photos.length);
  const next = () => onIndexChange((index + 1) % photos.length);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (multiple && e.key === "ArrowLeft") onIndexChange((index - 1 + photos.length) % photos.length);
      else if (multiple && e.key === "ArrowRight") onIndexChange((index + 1) % photos.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, multiple, photos.length, onIndexChange, onClose]);

  return (
    <div className="photo-lightbox" onClick={onClose} role="dialog" aria-modal="true" aria-label={`${alt} photos`}>
      <div className="photo-lightbox-stage" onClick={(e) => e.stopPropagation()}>
        {closeButton && (
          <button type="button" className="photo-lightbox-close" onClick={onClose} aria-label="Close photos" title="Close">
            <IconPlaceholder name="close" className="inline-icon-img" />
          </button>
        )}
        {panorama ? (
          <>
            <div className="photo-lightbox-pano">
              <PanoramaPhoto key={photo.path} path={photo.path} yaw={photo.viewYaw} pitch={photo.viewPitch} alt={alt} hint={!hintPlayed} onHintDone={() => setHintPlayed(true)} />
            </div>
            <Pano360Pill />
          </>
        ) : url ? (
          <img src={url} alt={alt} className={"photo-lightbox-image photo-swap" + (pending ? " photo-dimmed" : "")} />
        ) : (
          <div className="photo-lightbox-loading">{error ? "Couldn't load photo." : <PhotoLoading />}</div>
        )}
        {!panorama && url && pending && !error && <div className="photo-loading-veil"><PhotoLoading /></div>}
        {multiple && (
          <>
            <button type="button" className="photo-arrow photo-arrow-prev" onClick={prev} aria-label="Previous photo">
              <img src={chevronLeftWhite} alt="" className="inline-icon-img" />
            </button>
            <button type="button" className="photo-arrow photo-arrow-next" onClick={next} aria-label="Next photo">
              <img src={chevronRightWhite} alt="" className="inline-icon-img" />
            </button>
          </>
        )}
      </div>

      {multiple && (
        <div className="photo-lightbox-thumbs" onClick={(e) => e.stopPropagation()}>
          {photos.map((p, i) => (
            <Thumb key={p.path} photo={p} active={i === index} label={`Photo ${i + 1} of ${photos.length}`} onClick={() => onIndexChange(i)} />
          ))}
        </div>
      )}
    </div>
  );
}
