import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, Text } from "@react-three/drei";
import * as THREE from "three";
import { markerTypeInfo } from "../utils/constants";
import { toPosition, toAngles, initialCameraPosition, computeFov, TARGET_HORIZONTAL_FOV } from "../utils/panoramaMath";
import { useSecurePhotoUrl } from "../hooks/useSecurePhotoUrl";

// Genuinely missing before this fix — referenced below (m.type ===
// "equipment") but never actually defined anywhere in the codebase,
// which would throw "EQUIPMENT_MARKER_INFO is not defined" the moment
// an actual equipment marker was ever rendered. Deliberately not added
// to constants.js's MARKER_TYPES array, matching the reasoning already
// written into the comment on the Marker component below — kept local
// to this file instead. Gold rather than reusing any of the four
// existing marker colors (indoor room/facility/exit/hydrant) — this is
// a genuinely new, Virtual-Tour-specific marker type, and gold is
// specifically the brand's own "premium accent" color, a fitting,
// deliberate choice here rather than an arbitrary one.
const EQUIPMENT_MARKER_INFO = { icon: "📷", color: "#C9A24B" };

// A slight backward tilt on the hotspot arrow — just enough to hint
// "forward, into the scene" rather than "straight up the screen". Kept
// small on purpose: a steep lean makes the billboarded arrow look like
// it's swinging around as the view moves. The arrow itself is static.
const ARROW_FORWARD_LEAN = 0.26; // radians (~15°)

function PanoramaSphere({ url, onLoaded, onError, onSurfaceClick, placing }) {
  const [texture, setTexture] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setTexture(null);
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (tex) => {
        if (cancelled) return;
        tex.colorSpace = THREE.SRGBColorSpace;
        setTexture(tex);
        onLoaded?.();
      },
      undefined,
      () => {
        if (!cancelled) onError?.();
      }
    );
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!texture) return null;

  return (
    <mesh
      scale={[-1, 1, 1]}
      onClick={(e) => {
        if (!placing) return;
        e.stopPropagation();
        onSurfaceClick?.(toAngles(e.point));
      }}
    >
      <sphereGeometry args={[500, 60, 40]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} />
    </mesh>
  );
}

// Touch/stylus input has no hover state, so the "sneak-peek" preview
// (built around onPointerOver/onPointerOut below) has no touch
// equivalent — matchMedia("pointer: coarse") is the standard way to
// detect that up front rather than guessing from screen size, since a
// touchscreen kiosk monitor can be any width. Re-checked on change so a
// device with both a touchscreen and a mouse attached still tracks
// whichever was used most recently.
function useIsCoarsePointer() {
  const [coarse, setCoarse] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches
  );
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(pointer: coarse)");
    const onChange = () => setCoarse(mq.matches);
    mq.addEventListener ? mq.addEventListener("change", onChange) : mq.addListener(onChange);
    return () => {
      mq.removeEventListener ? mq.removeEventListener("change", onChange) : mq.removeListener(onChange);
    };
  }, []);
  return coarse;
}

function Hotspot({ yaw, pitch, label, photo, onClick, dimmed, highlighted, emergency }) {
  const pos = toPosition(yaw, pitch);
  const [hovered, setHovered] = useState(false);
  const isTouch = useIsCoarsePointer();
  // Only fetches once genuinely hovered — a hotspot never hovered never
  // triggers a photo fetch at all.
  const { url: previewUrl } = useSecurePhotoUrl(hovered ? photo : null);

  // Touch: first tap reveals the preview (reusing the same `hovered`
  // state hover already drives) instead of navigating; a second tap
  // while it's showing actually walks there — see handleClick below.
  // Auto-dismisses after a few seconds so a preview opened then
  // abandoned doesn't sit there forever waiting for a tap that never
  // comes back.
  useEffect(() => {
    if (!isTouch || !hovered) return;
    const timer = setTimeout(() => setHovered(false), 4000);
    return () => clearTimeout(timer);
  }, [isTouch, hovered]);

  const handlePointerOver = (e) => {
    if (isTouch) return; // touch drives `hovered` from the tap handler below instead
    e.stopPropagation();
    setHovered(true);
  };
  const handlePointerOut = (e) => {
    if (isTouch) return;
    e.stopPropagation();
    setHovered(false);
  };
  const handleClick = (e) => {
    e.stopPropagation();
    if (isTouch && !hovered) {
      setHovered(true); // tap-to-preview: show the sneak-peek, don't walk yet
      return;
    }
    setHovered(false);
    onClick(); // tap-again-to-go (touch), or the only tap needed at all (mouse)
  };

  // Only the highlighted hotspot pulses red during emergency routing — an
  // un-highlighted hotspot the visitor isn't meant to follow stays its
  // normal color, same as it already does outside emergency mode.
  const isPulsing = emergency && highlighted;
  // 3D materials can't read CSS custom properties — these mirror the brand
  // tokens: --accent (SDCA maroon), --success, a contrast-tuned emergency
  // red, and --text-subtle for the dimmed/placing state.
  const color = dimmed ? "#8c8180" : isPulsing ? "#c62a2c" : highlighted ? "#2e7d46" : "#a12124";
  // The arrow inside the hotspot always uses the design system's on-accent
  // contrast colour (--accent-contrast === #fff). White reads clearly on
  // every hotspot fill — maroon, success green, emergency red and the
  // dimmed grey — and matches how the app already paints icons and text
  // that sit on an accent-coloured surface, so the arrow stays visually
  // tied to the hotspot rather than looking like a separate element.
  const arrowColor = "#ffffff";
  const groupRef = useRef();

  // The hotspot is a permanently-visible wayfinding marker now, not a
  // hover-only "sneak peek". Hover keeps a small emphasis bump and still
  // brings up the photo preview below.
  const dotOpacity = hovered ? 0.95 : 0.85;
  const ringOpacity = hovered ? 0.7 : 0.5;

  const dotRadius = highlighted ? 18 : 14;

  // A plain filled up-arrow (head + stem), sized to sit inside the dot with
  // a comfortable margin. Flat 2D geometry; the mesh gets a small backward
  // tilt (ARROW_FORWARD_LEAN) for a subtle "forward" read — nothing
  // animated.
  const arrowShape = useMemo(() => {
    const w = dotRadius * 0.5;   // half-width of the arrow head
    const h = dotRadius * 0.62;  // half-height of the whole arrow
    const t = dotRadius * 0.2;   // half-thickness of the stem
    const shoulderY = h - w;
    const s = new THREE.Shape();
    s.moveTo(0, h);
    s.lineTo(w, shoulderY);
    s.lineTo(t, shoulderY);
    s.lineTo(t, -h);
    s.lineTo(-t, -h);
    s.lineTo(-t, shoulderY);
    s.lineTo(-w, shoulderY);
    s.closePath();
    return s;
  }, [dotRadius]);

  useFrame(({ camera, clock }) => {
    if (!groupRef.current) return;
    // Billboard the whole marker toward the camera so the always-visible
    // disc / ring / arrow never turn edge-on as the visitor looks around.
    groupRef.current.quaternion.copy(camera.quaternion);
    // Emergency: a gentle breathing scale on top of the billboard rotation
    // — reads as "urgent, alive". Kept imperative (no re-render) on
    // purpose; the "!" below is real geometry, so it inherits this scale
    // the same way the disc and ring do.
    const scale = isPulsing ? 1 + Math.sin(clock.elapsedTime * 4) * 0.15 : 1;
    groupRef.current.scale.setScalar(scale);
  });

  return (
    <group ref={groupRef} position={pos}>
      {/* Larger invisible hit area — lets the user hover/click ON OR NEAR
          the marker without aiming precisely. depthWrite disabled so this
          fully-transparent mesh can't occlude geometry behind it — a real
          bug hit once already with a similar invisible mask elsewhere in
          this project (the AR portal's mask). Handles all pointer/click
          interaction; the meshes below are purely decorative. Radius
          bumped from the original 32 for touch — a fingertip is far less
          precise than a mouse cursor, especially at kiosk arm's length. */}
      <mesh
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      >
        <sphereGeometry args={[42, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Flat disc + ring, billboarded (see useFrame) to face the camera. */}
      <mesh>
        <circleGeometry args={[dotRadius, 40]} />
        <meshBasicMaterial color={color} transparent opacity={dotOpacity} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh>
        <ringGeometry args={highlighted ? [20, 26, 40] : [16, 20, 40]} />
        <meshBasicMaterial color={color} transparent opacity={ringOpacity} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {isPulsing ? (
        // During emergency routing the arrow gives way to a "!" — same
        // white, still real geometry (not an Html overlay) so the pulse
        // scale reaches it too, exactly as the disc and ring get it.
        <Text position={[0, 0, 0.2]} fontSize={dotRadius} color={arrowColor} anchorX="center" anchorY="middle">
          !
        </Text>
      ) : (
        // Flat white arrow sitting just in front of the disc, tilted back a
        // touch (ARROW_FORWARD_LEAN) for a subtle forward lean. renderOrder
        // keeps it painted over the disc.
        <mesh position={[0, 0, 0.5]} rotation={[-ARROW_FORWARD_LEAN, 0, 0]} renderOrder={2}>
          <shapeGeometry args={[arrowShape]} />
          <meshBasicMaterial color={arrowColor} transparent opacity={1} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Sneak-peek preview — still only on genuine hover, a "check before
          you click" affordance, separate from the always-on marker itself. */}
      {hovered && (
        <Html
          distanceFactor={260}
          position={[0, 50, 0]}
          // Anchor the card by its BOTTOM edge (translate -100% on Y), not
          // its middle. `center` would pin the card's centre to the anchor
          // and the now-large card would swallow the hotspot; bottom-anchored
          // it always sits fully above the marker no matter how tall the
          // card grows with a long label. The +50 local Y clears the ring
          // (outer radius ~26) with a comfortable gap; -50% on X keeps it
          // horizontally centred over the hotspot.
          style={{ pointerEvents: "none", transform: "translate(-50%, -100%)" }}
        >
          {/* Styling lives in index.css → "Panorama overlays" so it stays on
              the brand tokens; only the image src is dynamic here. */}
          <div className="pano-hotspot-preview">
            <div className="pano-hotspot-preview-thumb">
              {previewUrl ? (
                <img src={previewUrl} alt={label} />
              ) : (
                <span>…</span>
              )}
            </div>
            <div className="pano-hotspot-preview-label">{label}</div>
          </div>
        </Html>
      )}
    </group>
  );
}

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
function Marker({ yaw, pitch, label, type, markerInfo, onClick, onRoomClick, onEquipmentClick, dimmed, selected }) {
  const pos = toPosition(yaw, pitch);
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
  const clickHandler = onClick
    ? (e) => { e.stopPropagation(); onClick(); }
    : isRoomClickable
      ? (e) => { e.stopPropagation(); onRoomClick(); }
      : isEquipmentClickable
        ? (e) => { e.stopPropagation(); onEquipmentClick(); }
        : undefined;
  const isClickable = !!clickHandler;

  const baseSize = 33;
  const hoverSize = 46;
  const size = hovered && isClickable ? hoverSize : baseSize;
  const fontSize = Math.round(13 * (size / 26));

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
      <Html center distanceFactor={260} style={{ pointerEvents: isClickable ? "auto" : "none" }}>
        {/* Layout/colour in index.css → "Panorama overlays"; only the
            per-marker size, type colour and selected ring are dynamic. */}
        <div
          className="pano-marker"
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
              boxShadow: selected
                ? "0 0 0 2px #fff, 0 0 8px rgba(32,27,27,0.55)"
                : "0 0 6px rgba(32,27,27,0.55)",
            }}
          >
            {info.icon}
          </div>
          <div className="pano-marker-label">{label}</div>
        </div>
      </Html>
    </group>
  );
}

// Three.js's fov is vertical, not horizontal, and @react-three/fiber
// already keeps aspect ratio correctly synced to the real viewport
// shape — so a FIXED vertical FOV mathematically produces a narrower
// HORIZONTAL view on a narrower screen, not a display bug, just the
// geometry of a fixed vertical angle applied to a narrower width.
// The field of view follows the window: see computeFov in utils/panoramaMath.js.
function usePanoramaFov() {
  const [fov, setFov] = useState(() =>
    typeof window !== "undefined" ? computeFov(window.innerWidth, window.innerHeight) : TARGET_HORIZONTAL_FOV
  );
  useEffect(() => {
    const updateFov = () => setFov(computeFov(window.innerWidth, window.innerHeight));
    window.addEventListener("resize", updateFov);
    // orientationchange fires on real device rotation more reliably than
    // resize alone on some touchscreen/tablet setups.
    window.addEventListener("orientationchange", updateFov);
    return () => {
      window.removeEventListener("resize", updateFov);
      window.removeEventListener("orientationchange", updateFov);
    };
  }, []);
  return fov;
}

/**
 * Props:
 *  - url: panorama image URL for the current node
 *  - hotspots: [{ id, name, yaw, pitch, photo }] — clickable arrows toward linked nodes; photo (optional) powers the hover sneak-peek
 *  - markers: [{ id, label, type, yaw, pitch }] — fixed point-of-interest labels, non-navigating
 *  - onNavigate(id): called when a hotspot is clicked
 *  - onMarkerClick(id): optional — called when a marker is clicked (admin editing only; omit for read-only display)
 *  - onError: called if the current panorama image fails to load
 *  - placing: bool — when true, clicking the panorama itself (not a hotspot/marker) reports the click angle
 *  - onPlaceAngle({yaw, pitch}): called when placing and the user clicks the sphere
 *  - highlightedId: optional neighbor id to render in a distinct color (used for directions)
 *  - emergencyMode: bool — when true, the highlighted hotspot pulses red instead of the normal green, for emergency exit routing
 *  - selectedMarkerId: optional marker id to render with a highlight ring (admin editing)
 *  - onRoomMarkerClick(marker): optional — called when a type:"room" marker is clicked (public viewer only; independent of onMarkerClick, which is for admin editing)
 *  - onEquipmentMarkerClick(marker): optional — called when a type:"equipment" marker is clicked (Virtual Tour public viewer only; independent of both props above — opens that marker's photo carousel)
 */
export default function PanoramaNav({
  url,
  hotspots,
  markers = [],
  onNavigate,
  onMarkerClick,
  onRoomMarkerClick,
  onEquipmentMarkerClick,
  onError,
  placing,
  onPlaceAngle,
  initialYaw = 0,
  initialPitch = 0,
  highlightedId = null,
  emergencyMode = false,
  selectedMarkerId = null,
}) {
  const cursor = placing ? "crosshair" : "grab";
  // @react-three/fiber reactively applies changes to the camera prop's
  // own properties to the live camera instance on every re-render
  // (including calling updateProjectionMatrix() itself) — so this
  // correctly updates live on an actual orientation change while the
  // viewer is already open, not just on initial mount.
  const fov = usePanoramaFov();
  return (
    <Canvas camera={{ position: initialCameraPosition(initialYaw, initialPitch), fov }} style={{ cursor }}>
      <PanoramaSphere
        url={url}
        onError={onError}
        placing={placing}
        onSurfaceClick={onPlaceAngle}
      />
      {hotspots.map((h) => (
        <Hotspot
          key={h.id}
          yaw={h.yaw}
          pitch={h.pitch}
          label={h.name}
          photo={h.photo}
          dimmed={placing}
          highlighted={!placing && h.id === highlightedId}
          emergency={emergencyMode}
          onClick={() => !placing && onNavigate(h.id, { yaw: h.yaw, pitch: h.pitch })}
        />
      ))}
      {markers.map((m) => (
        <Marker
          key={m.id}
          yaw={m.yaw}
          pitch={m.pitch}
          label={m.label}
          type={m.type}
          markerInfo={m.type === "equipment" ? EQUIPMENT_MARKER_INFO : undefined}
          dimmed={placing}
          selected={m.id === selectedMarkerId}
          onClick={onMarkerClick && !placing ? () => onMarkerClick(m.id) : undefined}
          onRoomClick={onRoomMarkerClick && !placing ? () => onRoomMarkerClick(m) : undefined}
          onEquipmentClick={onEquipmentMarkerClick && !placing ? () => onEquipmentMarkerClick(m) : undefined}
        />
      ))}
      <OrbitControls enablePan={false} enableZoom={false} rotateSpeed={-0.4} target={[0, 0, 0]} />
    </Canvas>
  );
}
