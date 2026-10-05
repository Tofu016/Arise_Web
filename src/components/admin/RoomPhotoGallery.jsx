import { useRef, useState } from "react";
import FilePickerButton from "../FilePickerButton";
import PhotoFocusPicker from "../PhotoFocusPicker";
import IconPlaceholder from "../IconPlaceholder";
import moveIcon from "../../assets/icons/arrows-out-cardinal.svg";
import { Pano360Pill } from "../RoomPanorama";
import { useSecurePhotoUrl } from "../../hooks/useSecurePhotoUrl";
import { useFlatPhotoUrl } from "../../hooks/useFlatPhotoUrl";
import { isPanorama, moveItem } from "../../utils/roomPhotos";

const TILE_PREVIEW = { width: 320, height: 200 };

function Tile({ photo, index, version, alt, over, onKind, onFocus, onRemove, onReblur, onDragStart, onDragEnter, onDrop, onDragEnd, busy }) {
  const panorama = isPanorama(photo);
  const { url: loaded } = useSecurePhotoUrl(photo.path, { version, thumbnail: panorama ? 1024 : true });
  const flatUrl = useFlatPhotoUrl(loaded, photo, TILE_PREVIEW);
  const tileRef = useRef(null);

  return (
    <li
      ref={tileRef}
      className={"room-photo-tile" + (over ? " room-photo-tile-over" : "")}
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={onDragEnter}
      onDrop={onDrop}
    >
      <div className="room-photo-tile-head">
        <span
          className="room-photo-tile-grip"
          draggable
          role="button"
          tabIndex={-1}
          aria-label={`Drag to reorder photo ${index + 1}`}
          title="Drag to reorder"
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", String(index));
            if (tileRef.current) e.dataTransfer.setDragImage(tileRef.current, 20, 20);
            onDragStart();
          }}
          onDragEnd={onDragEnd}
        >
          <img src={moveIcon} alt="" className="icon-placeholder-img" />
        </span>
      </div>

      <div className="room-photo-tile-image">
        {!flatUrl && <span className="field-hint">Loading…</span>}
        {flatUrl && !panorama && <PhotoFocusPicker url={flatUrl} alt={alt} focus={photo} onChange={onFocus} />}
        {flatUrl && panorama && <img src={flatUrl} alt={alt} />}
        {index === 0 && <span className="room-photo-thumbnail-pill">Thumbnail</span>}
        {panorama && <Pano360Pill />}
      </div>

      <div className="room-photo-tile-kind" role="group" aria-label={`Photo ${index + 1} kind`}>
        <button type="button" className={"room-photo-kind-btn" + (!panorama ? " room-photo-kind-btn-active" : "")} aria-pressed={!panorama} onClick={() => onKind("flat")}>Flat</button>
        <button type="button" className={"room-photo-kind-btn" + (panorama ? " room-photo-kind-btn-active" : "")} aria-pressed={panorama} onClick={() => onKind("360")}>360°</button>
      </div>

      <div className="room-photo-tile-actions">
        <button type="button" className="rescan-faces-btn" onClick={onReblur} disabled={busy}>
          <IconPlaceholder name="edit-pencil" /> Edit blur regions
        </button>
        <button type="button" className="admin-btn-secondary" onClick={onRemove} aria-label={`Remove photo ${index + 1}`}>Remove</button>
      </div>
    </li>
  );
}

// A room's or facility's photos as a sortable gallery: one upload button for
// flat and 360 photos alike, each photo marked flat or 360, dragged by the
// four-arrow grip at the top into the order visitors see. The
// first is the room's thumbnail in the directory. `photos` is [{ path, kind,
// x, y }]; `versions` maps a path to a number bumped when that photo was
// edited in place, so its preview reloads.
export default function RoomPhotoGallery({ photos, versions, roomName, uploadState, onChange, onFilesPick, onReblur }) {
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const uploading = uploadState === "uploading";

  const update = (index, patch) => onChange(photos.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  const endDrag = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  return (
    <div className="room-photo-gallery">
      <label>
        Photos
        <FilePickerButton accept="image/*" multiple label="Add Photos" onChange={onFilesPick} disabled={uploading} />
        <span className="field-hint">
          {uploading && "Uploading…"}
          {uploadState === "done" && "✓ Uploaded"}
          {uploadState === "error" && "⚠ Upload failed: check your connection."}
          {uploadState === "idle" && !photos.length && "No photos yet. Pick several at once; flat and 360° photos both go here."}
        </span>
      </label>
      {photos.length > 0 && (
        <p className="field-hint">
          Mark each photo Flat or 360°, and sort them by dragging the four-arrow grip at the top of each. The first photo is the thumbnail in the directory. On a flat photo, drag the gold frame to choose its square thumbnail in the room panel; a 360° photo is flattened there and can be looked around in the viewer.
        </p>
      )}
      {photos.length > 0 && (
        <ul className="room-photo-grid">
          {photos.map((p, i) => (
            <Tile
              key={p.path}
              photo={p}
              index={i}
              version={versions[p.path] || 0}
              alt={`${roomName} photo ${i + 1}`}
              over={dragIndex != null && overIndex === i && dragIndex !== i}
              busy={uploading}
              onKind={(kind) => update(i, { kind })}
              onFocus={(focus) => update(i, focus)}
              onRemove={() => onChange(photos.filter((_, j) => j !== i))}
              onReblur={() => onReblur(p.path)}
              onDragStart={() => setDragIndex(i)}
              onDragEnter={() => dragIndex != null && setOverIndex(i)}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex != null) onChange(moveItem(photos, dragIndex, i));
                endDrag();
              }}
              onDragEnd={endDrag}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
