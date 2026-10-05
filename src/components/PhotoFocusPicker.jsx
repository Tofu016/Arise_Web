import { useRef, useState } from "react";

// Shows a photo whole with a square frame on it: the part visitors see as the
// photo's square thumbnail in the room panel. Press or drag on the photo to
// move the frame. `focus` is { x, y } in CSS object-position percentages
// (50/50 = centered), the same value the room panel crops with.
export default function PhotoFocusPicker({ url, alt, focus, onChange }) {
  const imgRef = useRef(null);
  const [ratio, setRatio] = useState(null); // natural width / height
  const draggingRef = useRef(false);

  const moveTo = (e) => {
    if (!ratio || ratio === 1) return;
    const box = imgRef.current.getBoundingClientRect();
    const px = (e.clientX - box.left) / box.width;
    const py = (e.clientY - box.top) / box.height;
    // Only the long side of the photo has room for the frame to move.
    const along = (p, frame) => Math.round(Math.min(1, Math.max(0, (p - frame / 2) / (1 - frame))) * 100);
    if (ratio > 1) onChange({ x: along(px, 1 / ratio), y: focus.y });
    else onChange({ x: focus.x, y: along(py, ratio) });
  };

  let frameStyle = null;
  if (ratio) {
    if (ratio > 1) {
      const w = 100 / ratio;
      frameStyle = { width: `${w}%`, height: "100%", left: `${(focus.x / 100) * (100 - w)}%`, top: 0 };
    } else {
      const h = 100 * ratio;
      frameStyle = { width: "100%", height: `${h}%`, top: `${(focus.y / 100) * (100 - h)}%`, left: 0 };
    }
  }

  return (
    <div
      className={"photo-focus-picker" + (ratio && ratio !== 1 ? " photo-focus-picker-active" : "")}
      onPointerDown={(e) => {
        draggingRef.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        moveTo(e);
      }}
      onPointerMove={(e) => draggingRef.current && moveTo(e)}
      onPointerUp={() => { draggingRef.current = false; }}
      onPointerCancel={() => { draggingRef.current = false; }}
    >
      <img
        ref={imgRef}
        src={url}
        alt={alt}
        draggable={false}
        onLoad={(e) => setRatio(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)}
      />
      {frameStyle && <div className="photo-focus-frame" style={frameStyle} />}
    </div>
  );
}
