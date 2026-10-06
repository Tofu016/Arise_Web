import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PanoramaViewPicker from "./PanoramaViewPicker";
import { useFlatPhotoUrl, CELL_PREVIEW, SQUARE_PREVIEW } from "../../hooks/useFlatPhotoUrl";
import { viewBounds } from "../../utils/rectilinear";
import { CELL_FOV, DEFAULT_VIEW_FRAME, THUMBNAIL_FOV, cellView, thumbnailView } from "../../utils/roomPhotos";

// What an admin can set on a 360 photo, one picker each. The thumbnail frame is
// square (the room panel's square) and the directory cell's has the cell's wide
// shape; both zoom, within THUMBNAIL_FOV.
const VIEW_TARGETS = [
  {
    id: "view",
    label: "Default 360 View",
    hint: "Drag the frame to where visitors should look when they open this photo.",
    frame: () => DEFAULT_VIEW_FRAME,
    angles: (p) => ({ yaw: p.viewYaw ?? 0, pitch: p.viewPitch ?? 0 }),
    fromAngles: (yaw, pitch) => ({ viewYaw: yaw, viewPitch: pitch }),
  },
  {
    id: "thumb",
    label: "Thumbnail",
    resizable: true,
    hint: "The square shown in the room panel and photo strip. Drag the frame to move it and its edges or corners to zoom. The grey part is left out.",
    frame: (p) => ({ fov: thumbnailView(p).fov, aspect: 1 }),
    angles: (p) => thumbnailView(p),
    fromAngles: (yaw, pitch) => ({ thumbYaw: yaw, thumbPitch: pitch }),
    fromFov: (fov) => ({ thumbFov: fov }),
  },
  {
    id: "cell",
    label: "Directory",
    resizable: true,
    range: CELL_FOV,
    hint: "The directory row (the room's first photo only). Drag the frame to move it and its edges or corners to zoom, as far as you like. The grey and the room name sit over the left of the photo in the directory.",
    frame: (p) => ({ fov: cellView(p).fov, aspect: CELL_PREVIEW.height / CELL_PREVIEW.width }),
    angles: (p) => cellView(p),
    fromAngles: (yaw, pitch) => ({ cellYaw: yaw, cellPitch: pitch }),
    fromFov: (fov) => ({ cellFov: fov }),
  },
];

// The default view as a still, in the shape of the picker's frame for it.
const DEFAULT_VIEW_PREVIEW = { width: 480, height: Math.round(480 * DEFAULT_VIEW_FRAME.aspect) };
const defaultView = (p) => ({ yaw: p.viewYaw ?? 0, pitch: p.viewPitch ?? 0, fov: DEFAULT_VIEW_FRAME.fov });

const FIELDS = ["viewYaw", "viewPitch", "thumbYaw", "thumbPitch", "thumbFov", "cellYaw", "cellPitch", "cellFov"];

function Preview({ url, photo, size, view, label, alt, className }) {
  const flat = useFlatPhotoUrl(url, photo, size, view);
  return (
    <figure className="pano-view-preview">
      {flat ? <img className={className} src={flat} alt={`${alt}, ${label}`} /> : <div className={className + " pano-view-preview-empty"} />}
      <figcaption>{label}</figcaption>
    </figure>
  );
}

// The directory frame's width on screen, in pixels, given the map's drawn width,
// with the row's own shape; undefined until the map is measured.
function cellSizeOnMap(photo, mapWidth) {
  if (!mapWidth) return undefined;
  const { aspect, ...frame } = VIEW_TARGETS.find((t) => t.id === "cell").frame(photo);
  const width = viewBounds({ ...cellView(photo), ...frame, aspect }).width * mapWidth;
  return { width, height: width * aspect };
}

// The directory row as visitors see it, drawn as big as the frame is on the
// map: the photo under the sidebar-grey
// gradient with the room's name on it.
function CellPreview({ url, photo, roomName, alt, size }) {
  const flat = useFlatPhotoUrl(url, photo, CELL_PREVIEW, cellView(photo));
  return (
    <figure className="pano-view-preview">
      <div className="directory-room-row pano-view-cell" style={size}>
        <span>{roomName}</span>
        {flat && <img src={flat} alt={`${alt}, directory row`} className="directory-room-photo" />}
      </div>
      <figcaption>Directory row</figcaption>
    </figure>
  );
}

// A window over the page for setting a 360 photo's default view and its two
// thumbnails (like the blur editor's). `url` is the photo's flat-map image,
// `photo` the working copy and `onChange(patch)` applies edits to it right away,
// so the previews follow; Cancel puts back what the photo had on opening.
export default function PanoramaViewDialog({ url, photo, alt, roomName, onChange, onClose }) {
  const [target, setTarget] = useState("view");
  const [mapWidth, setMapWidth] = useState(0); // the map's drawn width in px
  const mode = VIEW_TARGETS.find((t) => t.id === target);
  const original = useRef(Object.fromEntries(FIELDS.map((f) => [f, photo[f]])));

  const cancel = () => {
    onChange(original.current);
    onClose();
  };

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && cancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // cancel only reads a ref and props that don't change while open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div className="modal-overlay">
      <div className="modal pano-view-dialog" role="dialog" aria-modal="true" aria-label="Set default view and thumbnails" onClick={(e) => e.stopPropagation()}>
        <div className="preview-header">
          <h3>Set default view and thumbnails</h3>
          <button className="close-btn" onClick={cancel} aria-label="Cancel">✕</button>
        </div>

        <div className="pano-view-tabs" role="group" aria-label="View to set">
          {VIEW_TARGETS.map((t) => (
            <button key={t.id} type="button" className={"pano-view-tab" + (target === t.id ? " pano-view-tab-active" : "")} aria-pressed={target === t.id} onClick={() => setTarget(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        <PanoramaViewPicker
          url={url}
          alt={alt}
          frame={mode.frame(photo)}
          sizeRange={mode.resizable ? mode.range ?? THUMBNAIL_FOV : undefined}
          cellLabel={target === "cell" ? roomName : undefined}
          onMeasure={setMapWidth}
          angles={mode.angles(photo)}
          onChange={({ yaw, pitch }) => onChange(mode.fromAngles(yaw, pitch))}
          onResize={mode.resizable ? (fov) => onChange(mode.fromFov(fov)) : undefined}
        />
        <p className="field-hint">{mode.hint}</p>

        <div className="pano-view-previews">
          <Preview url={url} photo={photo} size={DEFAULT_VIEW_PREVIEW} view={defaultView(photo)} label="Default 360 View" alt={alt} className="pano-view-preview-default" />
          <Preview url={url} photo={photo} size={SQUARE_PREVIEW} view={thumbnailView(photo)} label="Room panel thumbnail" alt={alt} className="pano-view-preview-square" />
          <CellPreview url={url} photo={photo} roomName={roomName} alt={alt} size={cellSizeOnMap(photo, mapWidth)} />
        </div>

        <div className="form-actions">
          <button className="primary" onClick={onClose}>Done</button>
          <button onClick={cancel}>Cancel</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
