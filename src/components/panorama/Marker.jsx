import { useState } from "react";
import { useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { markerTypeInfo } from "../../utils/constants";
import { toPosition } from "../../utils/panoramaMath";
import IconPlaceholder from "../IconPlaceholder";

// NOTE: sized by the canvas's shorter side alone, while Hotspot uses
// overlayScale (which also follows the FOV). The two are inconsistent;
// unifying them would change how markers look, so that is a separate decision.
// A fixed point-of-interest label (room/facility/exit/hydrant) — stays put,
// doesn't navigate anywhere when clicked. Rendered as an HTML overlay (via
// drei's <Html>) rather than 3D geometry, since crisp text is much simpler
// that way than building actual 3D text meshes.
//
// Base icon size increased ~28% (26px -> 33px, "too small" per feedback),
// growing a further ~40% on hover (33px -> 46px) for a clear, responsive
// hover state. onClick stays exactly as it was (admin editing — select a
// marker for editing, any type). onRoomClick is new and separate: only
// wired up for type==="room" markers, used by the public viewer to open
// that room's info panel — these two click paths are independent and can
// both be present without conflicting (admin editing never sets
// onRoomClick; the public viewer never sets onClick).
export function Marker({ yaw, pitch, label, type, markerInfo, onClick, onRoomClick, onEquipmentClick, onElevatorClick, dimmed, selected, highlighted }) {
  const pos = toPosition(yaw, pitch);
  // Sized in real CSS pixels (no distanceFactor on the <Html> below — that
  // tied the size to the camera's FOV and left icons ~13px on desktop and
  // smaller still on the kiosk), scaled with the screen's shorter side.
  const canvasSize = useThree((state) => state.size);
  const uiScale = Math.min(1.5, Math.max(0.75, Math.min(canvasSize.width, canvasSize.height) / 1080));
  // markerInfo lets a caller override the icon/color lookup entirely,
  // rather than this component always resolving it from constants.js's
  // MARKER_TYPES — needed for the Virtual Tour's "equipment" marker type,
  // which isn't (and deliberately shouldn't be) in that shared array: it
  // would otherwise incorrectly show up as a selectable type in the
  // indoor system's own Navigation Editor marker dropdown, and without
  // this override, markerTypeInfo("equipment") would silently fall back
  // to "Facility"'s icon/color instead of failing loudly. Every existing
  // caller keeps working exactly as before, since none of them pass this.
  const info = markerInfo || markerTypeInfo(type);
  const [hovered, setHovered] = useState(false);

  // onEquipmentClick is a separate, parallel prop to onRoomClick rather
  // than extending onRoomClick's own type==="room" gate to also cover
  // "equipment" — MainPage.jsx already passes a working onRoomMarkerClick
  // today; keeping these two click paths independent means nothing about
  // that existing, working call needs to change for this new type to
  // work, and "room click" vs "equipment click" stay clearly distinct
  // rather than one prop silently meaning two different things.
  const isRoomClickable = type === "room" && !!onRoomClick;
  const isEquipmentClickable = type === "equipment" && !!onEquipmentClick;
  // Elevator markers are the one type that's clickable in the public
  // viewer without being a "room"/"equipment" special case — see
  // MainPage.jsx's handleElevatorMarkerClick: unlike every other marker,
  // clicking one actually moves the visitor (a Jump to another floor).
  const isElevatorClickable = type === "elevator" && !!onElevatorClick;
  const clickHandler = onClick
    ? (e) => { e.stopPropagation(); onClick(); }
    : isRoomClickable
      ? (e) => { e.stopPropagation(); onRoomClick(); }
      : isEquipmentClickable
        ? (e) => { e.stopPropagation(); onEquipmentClick(); }
        : isElevatorClickable
          ? (e) => { e.stopPropagation(); onElevatorClick(); }
          : undefined;
  const isClickable = !!clickHandler;

  const baseSize = Math.round(48 * uiScale);
  const hoverSize = Math.round(64 * uiScale);
  const size = hovered && isClickable ? hoverSize : baseSize;
  const fontSize = Math.round(size * 0.5);
  const labelFontSize = Math.round(16 * uiScale);

  return (
    <group position={pos}>
      {/* onClick lives on the actual DOM div below, NOT here on the group
          — this group has no raycastable mesh geometry (only an <Html>
          child, which renders separate DOM content entirely outside
          Three.js's own scene graph), so a click handler here would never
          fire at all. Fiber's pointer events only work on objects its own
          raycaster can actually hit — confirmed this was the real,
          structural cause of room markers never responding to clicks,
          not a data-matching problem. */}
      <Html
        center
        // drei's default z-index range reaches ~16.7 million, which floats
        // the marker above every dialog and panel. Pin it to the bottom
        // layer so the page's own UI always sits over it, as with the
        // (canvas-drawn) hotspots.
        zIndexRange={[0, 0]}
        style={{ pointerEvents: isClickable ? "auto" : "none" }}>
        {/* Layout/colour in index.css → "Panorama overlays"; only the
            per-marker size, type colour and selected ring are dynamic. */}
        <div
          className={"pano-marker" + (highlighted ? " pano-marker-highlighted" : "")}
          style={{ cursor: isClickable ? "pointer" : "default", opacity: dimmed ? 0.35 : 1 }}
          onClick={clickHandler}
          onMouseEnter={() => isClickable && setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <div
            className="pano-marker-dot"
            style={{
              width: size,
              height: size,
              fontSize,
              background: info.color,
              // Left to the .pano-marker-highlighted pulse when highlighted.
              boxShadow: highlighted
                ? undefined
                : selected
                  ? "0 0 0 2px #fff, 0 0 8px rgba(32,27,27,0.55)"
                  : "0 0 6px rgba(32,27,27,0.55)",
            }}
          >
            {info.iconPlaceholder ? <IconPlaceholder name={info.iconPlaceholder} /> : info.icon}
          </div>
          <div className="pano-marker-label" style={{ fontSize: labelFontSize }}>{label}</div>
        </div>
      </Html>
    </group>
  );
}
