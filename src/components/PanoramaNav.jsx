import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html, Text } from "@react-three/drei";
import * as THREE from "three";
import { markerTypeInfo } from "../utils/constants";
import { toPosition, toAngles, initialCameraPosition, computeFov, overlayScale, TARGET_HORIZONTAL_FOV, clampZoom, zoomedFov, MIN_ZOOM, MAX_ZOOM } from "../utils/panoramaMath";
import { useSecurePhotoUrl } from "../hooks/useSecurePhotoUrl";
import { useRectilinearPreview } from "../hooks/useRectilinearPreview";

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

// Period of the hotspot's outer-ring pulse.
const RING_PULSE_SECONDS = 2;

function PanoramaSphere({ texture, onSurfaceClick, placing }) {
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

const CROSSFADE_SECONDS = 0.3;

// The panorama being replaced, drawn just inside the new one and faded out
// over it, so a move dissolves instead of cutting. Not clickable.
function FadingSphere({ texture, onDone }) {
  const material = useRef();
  const elapsed = useRef(0);
  useFrame((_, delta) => {
    elapsed.current += delta;
    const t = Math.min(1, elapsed.current / CROSSFADE_SECONDS);
    if (material.current) material.current.opacity = 1 - t;
    if (t >= 1) onDone();
  });
  return (
    <mesh scale={[-1, 1, 1]} renderOrder={1} raycast={() => null}>
      <sphereGeometry args={[499, 60, 40]} />
      <meshBasicMaterial ref={material} map={texture} side={THREE.BackSide} transparent depthWrite={false} />
    </mesh>
  );
}

// Aims the camera at the entry direction of a newly swapped-in scene. The
// Canvas outlives moves, so this can't rely on the camera's initial position.
function CameraAim({ aimKey, yaw, pitch }) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls);
  const lastKey = useRef(aimKey);
  useEffect(() => {
    if (lastKey.current === aimKey) return;
    lastKey.current = aimKey;
    camera.position.set(...initialCameraPosition(yaw, pitch));
    controls?.update();
  }, [aimKey, yaw, pitch, camera, controls]);
  return null;
}

// How fast dragging turns the view: bigger = the view moves further for the
// same finger (or mouse) movement, smaller = slower and finer. The sign only
// sets the drag direction, so keep the numbers positive and change these two.
//   TOUCH_ROTATE_SPEED   the kiosk and any touch screen — tune this for the kiosk
//   MOUSE_ROTATE_SPEED   mouse dragging on desktop and the admin previews
const TOUCH_ROTATE_SPEED = 0.8;
const MOUSE_ROTATE_SPEED = 0.4;

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

function Hotspot({ yaw, pitch, label, photo, onClick, dimmed, highlighted, emergency, alwaysPreview, previewHidden, fov }) {
  const pos = toPosition(yaw, pitch);
  // Keeps the marker the same apparent size on any screen (see overlayScale).
  const canvasSize = useThree((state) => state.size);
  const uiScale = overlayScale(canvasSize.width, canvasSize.height, fov);
  const [hovered, setHovered] = useState(false);
  const isTouch = useIsCoarsePointer();
  // Kiosk: the preview is permanently shown, so a tap just walks there.
  // `clicked`: this hotspot was just used to leave the scene, so its preview
  // goes away at once instead of lingering while the next photo loads.
  const [clicked, setClicked] = useState(false);
  // `facing`: the hotspot is in front of the camera. The preview is only
  // mounted then. drei's <Html> re-places itself only when its projected
  // position changes, so one first placed while the hotspot was behind the
  // camera (e.g. the link back where you came from, right after a move)
  // could sit stuck over the view ahead until you looked round to it.
  // Mounting it only while facing it means it always starts from a fresh,
  // correct placement.
  const [facing, setFacing] = useState(false);
  const showPreview = previewHidden || clicked || !facing ? false : alwaysPreview || hovered;
  // Only fetches once the preview is actually shown — a hotspot that never
  // shows one never triggers a photo fetch at all.
  const { url: photoUrl } = useSecurePhotoUrl(showPreview ? photo : null, { cached: true });
  // The photo is a flat 360° map; show a normal-looking view of it, looking
  // the way the visitor will be facing on arrival (this hotspot's yaw). Falls
  // back to the raw photo if the projection can't be made.
  const projected = useRectilinearPreview(photoUrl, yaw);
  const previewUrl = projected || photoUrl;

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
    if (isTouch && !hovered && !alwaysPreview) {
      setHovered(true); // tap-to-preview: show the sneak-peek, don't walk yet
      return;
    }
    setHovered(false);
    setClicked(true);
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
  const pulseRef = useRef();
  const cameraDir = useMemo(() => new THREE.Vector3(), []);
  const hotspotDir = useMemo(() => new THREE.Vector3(...toPosition(yaw, pitch)).normalize(), [yaw, pitch]);

  // The hotspot is a permanently-visible wayfinding marker now, not a
  // hover-only "sneak peek". Hover keeps a small emphasis bump and still
  // brings up the photo preview below.
  const dotOpacity = hovered ? 0.95 : 0.85;
  const ringOpacity = hovered ? 0.7 : 0.5;

  const dotRadius = highlighted ? 18 : 14;

  // A wide upside-down "V" (chevron) sized to sit inside the dot, centred
  // vertically. Flat 2D geometry with a constant stroke thickness.
  const arrowShape = useMemo(() => {
    const w = dotRadius * 0.55;      // half-width of the chevron
    const rise = dotRadius * 0.4;    // height from apex down to the arm ends
    const k = dotRadius * 0.26;      // stroke thickness (vertical)
    const apex = (rise + k) / 2;
    const armEnd = apex - rise;
    const s = new THREE.Shape();
    s.moveTo(0, apex);
    s.lineTo(w, armEnd);
    s.lineTo(w, armEnd - k);
    s.lineTo(0, apex - k);
    s.lineTo(-w, armEnd - k);
    s.lineTo(-w, armEnd);
    s.closePath();
    return s;
  }, [dotRadius]);

  useFrame(({ camera, clock }) => {
    if (!groupRef.current) return;
    // cos(~78°): generous, so a card near the screen edge still shows.
    const nowFacing = camera.getWorldDirection(cameraDir).dot(hotspotDir) > 0.2;
    if (nowFacing !== facing) setFacing(nowFacing);
    // Pulse ring: every RING_PULSE_SECONDS an extra copy of the ring
    // expands outward and fades, then restarts.
    if (pulseRef.current) {
      const phase = (clock.elapsedTime % RING_PULSE_SECONDS) / RING_PULSE_SECONDS;
      pulseRef.current.scale.setScalar(1 + phase * 0.6);
      pulseRef.current.material.opacity = ringOpacity * (1 - phase);
    }
    // Billboard the whole marker toward the camera so the always-visible
    // disc / ring / arrow never turn edge-on as the visitor looks around.
    groupRef.current.quaternion.copy(camera.quaternion);
    // Emergency: a gentle breathing scale on top of the billboard rotation
    // — reads as "urgent, alive". Kept imperative (no re-render) on
    // purpose; the "!" below is real geometry, so it inherits this scale
    // the same way the disc and ring do.
    const scale = isPulsing ? 1 + Math.sin(clock.elapsedTime * 4) * 0.15 : 1;
    groupRef.current.scale.setScalar(scale * uiScale);
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
      {/* Extra ring copy that expands and fades (see useFrame); the static
          ring above stays put. */}
      <mesh ref={pulseRef}>
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
        // Flat white chevron sitting just in front of the disc. renderOrder
        // keeps it painted over the disc.
        <mesh position={[0, 0, 0.5]} renderOrder={2}>
          <shapeGeometry args={[arrowShape]} />
          <meshBasicMaterial color={arrowColor} transparent opacity={1} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Sneak-peek preview — on hover (or always, on the kiosk), a "check
          before you click" affordance separate from the marker itself. */}
      {showPreview && (
        <Html
          // No distanceFactor: the card is plain CSS pixels (sized in
          // index.css). With it, the card's size followed the camera's FOV
          // and came out at only ~0.2-0.4x of its CSS size.
          zIndexRange={[0, 0]} // stays under the page's own UI, like the marker overlays
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
  const clickHandler = onClick
    ? (e) => { e.stopPropagation(); onClick(); }
    : isRoomClickable
      ? (e) => { e.stopPropagation(); onRoomClick(); }
      : isEquipmentClickable
        ? (e) => { e.stopPropagation(); onEquipmentClick(); }
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
          <div className="pano-marker-label" style={{ fontSize: labelFontSize }}>{label}</div>
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
// heightFraction is how much of the window's height the canvas actually
// occupies (1 = all of it), so a canvas inset by whitespace still gets the
// FOV for its own, shorter shape.
function usePanoramaFov(heightFraction) {
  const [fov, setFov] = useState(() =>
    typeof window !== "undefined"
      ? computeFov(window.innerWidth, window.innerHeight * heightFraction)
      : TARGET_HORIZONTAL_FOV
  );
  useEffect(() => {
    const updateFov = () => setFov(computeFov(window.innerWidth, window.innerHeight * heightFraction));
    window.addEventListener("resize", updateFov);
    // orientationchange fires on real device rotation more reliably than
    // resize alone on some touchscreen/tablet setups.
    window.addEventListener("orientationchange", updateFov);
    return () => {
      window.removeEventListener("resize", updateFov);
      window.removeEventListener("orientationchange", updateFov);
    };
  }, [heightFraction]);
  return fov;
}

// Kiosk zoom level (1 = the screen's own default view). Changed only by the
// on-screen + / - / reset buttons — there is deliberately no two-finger pinch
// or wheel zoom: the kiosk's touch hardware reports two-finger gestures
// unreliably.
const BUTTON_ZOOM_FACTOR = 1.25; // one tap of + or -

function useZoom() {
  const [zoom, setZoomState] = useState(1);
  const setZoom = (z) => setZoomState(clampZoom(z));
  return { zoom, setZoom };
}

// Applies the zoomed FOV to the live camera every frame. Done here rather
// than through <Canvas camera>, whose reactive re-apply also resets the
// camera position (the view direction) on every FOV change.
function FovController({ fov }) {
  useFrame(({ camera }) => {
    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  });
  return null;
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
 *  - sceneKey: optional identity of the scene (e.g. the node id). When given, a change of scene keeps the previous panorama, hotspots and markers up until the new photo has loaded, then cross-fades and aims at initialYaw/initialPitch — so the parent should NOT remount PanoramaNav (no key=) to move between scenes. When omitted, a new url simply replaces the scene
 *  - heightFraction: optional 0-1 share of the window height the panorama's container fills (default 1) — only used to derive the right FOV
 *  - alwaysShowPreview: bool — kiosk view: every hotspot's photo preview is always shown, and a single tap navigates (no tap-to-preview step)
 *  - zoomable: bool — kiosk view: on-screen + / - / reset buttons zoom the panorama (no pinch), with a small level indicator; hidden along with the previews while previewsHidden
 *  - previewsHidden: bool — hides every hotspot preview (used while a menu/dialog is open over the panorama)
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
  sceneKey,
  heightFraction = 1,
  alwaysShowPreview = false,
  previewsHidden = false,
  zoomable = false,
}) {
  const cursor = placing ? "crosshair" : "grab";
  // The kiosk (zoomable) is always touch, even if the OS still reports a mouse.
  const touchInput = useIsCoarsePointer() || zoomable;
  // @react-three/fiber reactively applies changes to the camera prop's
  // own properties to the live camera instance on every re-render
  // (including calling updateProjectionMatrix() itself) — so this
  // correctly updates live on an actual orientation change while the
  // viewer is already open, not just on initial mount.
  const baseFov = usePanoramaFov(heightFraction);
  const { zoom, setZoom } = useZoom();
  const fov = zoomable ? zoomedFov(baseFov, zoom) : baseFov;

  // What's actually on screen. Props describe the scene we're heading to;
  // `shown` is the last one whose texture finished loading, with its own
  // hotspots/markers/entry angle snapshotted at that moment.
  const holdsScene = sceneKey !== undefined;
  const key = sceneKey ?? url;
  const [shown, setShown] = useState(null);
  const [leaving, setLeaving] = useState(null); // previous texture, mid-fade
  const shownRef = useRef(null);
  const leavingRef = useRef(null);
  const latest = useRef({ hotspots, markers, initialYaw, initialPitch, onError });
  useEffect(() => {
    latest.current = { hotspots, markers, initialYaw, initialPitch, onError };
  });
  // The Canvas is created once with the first scene's entry angle; later
  // scenes are aimed by CameraAim when they swap in.
  const [firstCameraPosition] = useState(() => initialCameraPosition(initialYaw, initialPitch));

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    new THREE.TextureLoader().load(
      url,
      (tex) => {
        if (cancelled) {
          tex.dispose();
          return;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        const { hotspots: hs, markers: ms, initialYaw: yaw, initialPitch: pitch } = latest.current;
        const previous = shownRef.current;
        shownRef.current = { key, texture: tex, hotspots: hs, markers: ms, yaw, pitch };
        leavingRef.current?.dispose(); // a fade still running when another move lands
        leavingRef.current = holdsScene ? previous?.texture ?? null : null;
        if (!holdsScene) previous?.texture.dispose();
        setLeaving(leavingRef.current);
        setShown(shownRef.current);
      },
      undefined,
      () => {
        if (!cancelled) latest.current.onError?.();
      }
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, key]);

  // Free the GPU memory of whichever texture is still up on unmount.
  useEffect(
    () => () => {
      shownRef.current?.texture.dispose();
      leavingRef.current?.dispose();
    },
    []
  );

  // Live props only once the screen has caught up with them; until then the
  // scene being left keeps its own hotspots and markers.
  const matches = shown?.key === key;
  const visible = holdsScene || matches ? shown : null;
  const live = !holdsScene || !shown || matches;
  const shownHotspots = live ? hotspots : shown.hotspots;
  const shownMarkers = live ? markers : shown.markers;

  const canvas = (
    <Canvas camera={{ position: firstCameraPosition, fov: baseFov }} style={{ cursor }}>
      {zoomable && <FovController fov={fov} />}
      {visible && <PanoramaSphere texture={visible.texture} placing={placing} onSurfaceClick={onPlaceAngle} />}
      {leaving && (
        <FadingSphere
          key={leaving.uuid}
          texture={leaving}
          onDone={() => {
            leaving.dispose();
            leavingRef.current = null;
            setLeaving(null);
          }}
        />
      )}
      {holdsScene && shown && <CameraAim aimKey={shown.texture.uuid} yaw={shown.yaw} pitch={shown.pitch} />}
      {shownHotspots.map((h) => (
        <Hotspot
          // Scoped to the scene: a hotspot with the same target id in the
          // next scene is a new marker, not this one carried over with its
          // stale hover/clicked state.
          key={`${live ? key : shown.key}:${h.id}`}
          yaw={h.yaw}
          pitch={h.pitch}
          label={h.name}
          photo={h.photo}
          dimmed={placing}
          highlighted={!placing && h.id === highlightedId}
          emergency={emergencyMode}
          fov={fov}
          alwaysPreview={alwaysShowPreview && !placing}
          // Also hidden while a move is loading: `!live` means the screen is
          // still showing the scene being left.
          previewHidden={previewsHidden || !live}
          onClick={() => !placing && onNavigate(h.id, { yaw: h.yaw, pitch: h.pitch })}
        />
      ))}
      {shownMarkers.map((m) => (
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
      <OrbitControls makeDefault enableDamping={false} enablePan={false} enableZoom={false} rotateSpeed={-(touchInput ? TOUCH_ROTATE_SPEED : MOUSE_ROTATE_SPEED)} target={[0, 0, 0]} />
    </Canvas>
  );

  if (!zoomable) return canvas;
  return (
    <div className="pano-zoom-wrap">
      {canvas}
      {/* Top-right of the panorama band: level indicator (only while zoomed
          away from the default 1.0x) beside the + / - / reset buttons. Hidden, like
          the hotspot previews, while a menu/dialog is open over the panorama. */}
      {!previewsHidden && (
        <div className="pano-zoom-controls">
          {zoom.toFixed(1) !== "1.0" && (
            <span className="pano-zoom-indicator" role="status" aria-label={`Zoom ${zoom.toFixed(1)}x`}>
              {zoom.toFixed(1)}×
            </span>
          )}
          <div className="pano-zoom-buttons">
            <button
              type="button"
              className="pano-zoom-btn"
              onClick={() => setZoom(zoom * BUTTON_ZOOM_FACTOR)}
              disabled={zoom >= MAX_ZOOM}
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              className="pano-zoom-btn"
              onClick={() => setZoom(zoom / BUTTON_ZOOM_FACTOR)}
              disabled={zoom <= MIN_ZOOM}
              aria-label="Zoom out"
            >
              −
            </button>
            <button
              type="button"
              className="pano-zoom-btn"
              onClick={() => setZoom(1)}
              disabled={zoom.toFixed(1) === "1.0"}
              title="Reset zoom"
              aria-label="Reset zoom"
            >
              ↺
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
