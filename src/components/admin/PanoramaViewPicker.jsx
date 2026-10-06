import { useEffect, useRef } from "react";
import { equirectToAngles, viewFovAt, viewOutline, viewPoint } from "../../utils/rectilinear";

const MAX_PITCH = 85;

// Where the resize handles sit on the frame: the view's own edge midpoints and
// corners (across, up), and the cursor.
const HANDLES = [
  ["n", 0, 1, "ns-resize"],
  ["s", 0, -1, "ns-resize"],
  ["e", 1, 0, "ew-resize"],
  ["w", -1, 0, "ew-resize"],
  ["nw", -1, 1, "nwse-resize"],
  ["se", 1, -1, "nwse-resize"],
  ["ne", 1, 1, "nesw-resize"],
  ["sw", -1, -1, "nesw-resize"],
];

const SHIFTS = [-1, 0, 1];

// A 360 photo laid out whole (the equirectangular map) with a gold outline on
// the part a visitor will see and the rest greyed out. The outline is the exact
// region of the map that view shows, so it curves the further it looks from the
// horizon. Press or drag anywhere on the map to center the view there.
//   angles  { yaw, pitch } in degrees (the view's center)
//   frame   { fov, aspect }: how wide the view is in degrees, and height / width
//           of the picture it makes
//   onResize(fov) and sizeRange { min, max }: with them, dragging a handle on the
//           outline's edge or corner resizes the view about its center
//   cellLabel  a room name; draws the directory row's gradient and name over the
//           view, showing which part of the row the name and grey hide
//   onMeasure(width)  the drawn width of the map in pixels (its height is half)
export default function PanoramaViewPicker({ url, alt, angles, frame, onChange, onResize, sizeRange, cellLabel, onMeasure }) {
  const boxRef = useRef(null);
  const draggingRef = useRef(false);
  const resizingRef = useRef(false);

  useEffect(() => {
    const box = boxRef.current;
    if (!box || !onMeasure) return undefined;
    const observer = new ResizeObserver(() => onMeasure(box.getBoundingClientRect().width));
    observer.observe(box);
    return () => observer.disconnect();
  }, [onMeasure]);

  const pointerOnMap = (e) => {
    const box = boxRef.current.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)), Math.min(1, Math.max(0, (e.clientY - box.top) / box.height))];
  };

  const view = { ...angles, ...frame };

  const resizeTo = (e) => {
    const [u, v] = pointerOnMap(e);
    const fov = viewFovAt(view, u, v);
    if (fov == null) return;
    onResize(Math.round(Math.min(sizeRange.max, Math.max(sizeRange.min, fov))));
  };

  const moveTo = (e) => {
    const [u, v] = pointerOnMap(e);
    const [yaw, pitch] = equirectToAngles(u, v);
    onChange({ yaw: Math.round(yaw), pitch: Math.round(Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch))) });
  };

  const startResize = (e) => {
    e.stopPropagation();
    resizingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const moveResize = (e) => {
    if (resizingRef.current) resizeTo(e);
  };
  const endResize = () => {
    resizingRef.current = false;
  };

  // The outline in map percentages, drawn again a full width to either side so
  // a view crossing the seam shows on both edges (the box clips the rest).
  const outline = viewOutline(view).map(([u, v]) => [u * 100, v * 100]);
  const path = (shift) => `M${outline.map(([x, y]) => `${x + shift * 100} ${y}`).join("L")}Z`;
  // The grey: the whole map with each outline cut out of it (even-odd).
  const dim = `M0 0H100V100H0Z${SHIFTS.map(path).join("")}`;

  const xs = outline.map((p) => p[0]);
  const ys = outline.map((p) => p[1]);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const boxW = Math.max(...xs) - left;
  const boxH = Math.max(...ys) - top;
  const clip = `polygon(${outline.map(([x, y]) => `${((x - left) / boxW) * 100}% ${((y - top) / boxH) * 100}%`).join(",")})`;

  return (
    <div
      ref={boxRef}
      className="photo-focus-picker photo-focus-picker-active panorama-view-picker"
      onPointerDown={(e) => {
        draggingRef.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        moveTo(e);
      }}
      onPointerMove={(e) => draggingRef.current && moveTo(e)}
      onPointerUp={() => { draggingRef.current = false; }}
      onPointerCancel={() => { draggingRef.current = false; }}
    >
      <img src={url} alt={alt} draggable={false} />
      <svg className="panorama-view-dim" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d={dim} fillRule="evenodd" />
      </svg>
      {cellLabel !== undefined &&
        SHIFTS.map((shift) => (
          <div
            key={shift}
            className="photo-focus-cell-fade"
            aria-hidden="true"
            style={{ left: `${left + shift * 100}%`, top: `${top}%`, width: `${boxW}%`, height: `${boxH}%`, clipPath: clip }}
          >
            <span>{cellLabel}</span>
          </div>
        ))}
      <svg className="panorama-view-dim" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {SHIFTS.map((shift) => (
          <path key={shift} d={path(shift)} className="panorama-view-outline" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      {onResize &&
        HANDLES.map(([name, sx, sy, cursor]) => {
          const [u, v] = viewPoint(view, sx, sy);
          return (
            <span
              key={name}
              className="photo-focus-handle"
              style={{ left: `${u * 100}%`, top: `${v * 100}%`, cursor }}
              onPointerDown={startResize}
              onPointerMove={moveResize}
              onPointerUp={endResize}
              onPointerCancel={endResize}
            />
          );
        })}
    </div>
  );
}
