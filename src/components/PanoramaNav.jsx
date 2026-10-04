import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { initialCameraPosition, zoomedFov } from "../utils/panoramaMath";
import { PanoramaSphere, FadingSphere } from "./panorama/Spheres";
import { CameraAim, AutoPan, FovController, CaptureAngle } from "./panorama/camera";
import { KeyboardNav } from "./panorama/KeyboardNav";
import { usePanoramaFov, TOUCH_ROTATE_SPEED, MOUSE_ROTATE_SPEED } from "./panorama/cameraSettings";
import { Hotspot } from "./panorama/Hotspot";
import { Marker } from "./panorama/Marker";
import { ZoomControls } from "./panorama/ZoomControls";
import { ZoomIndicator } from "./panorama/ZoomIndicator";
import { useZoom } from "./panorama/useZoom";
import { usePanoramaScene } from "./panorama/usePanoramaScene";
import { useIsCoarsePointer } from "./panorama/useIsCoarsePointer";
import noImagePanorama from "../assets/images/no-image.jpg";

// How long the "No location in front." hint stays up after W/Up finds
// nothing to walk to.
const NOTHING_AHEAD_HINT_MS = 1800;

// Held-Shift/Control keyboard zoom: how many wheel-deltaY-equivalent units
// per second of holding feed into zoomByWheel (tuned to land roughly where
// a few slow scroll notches would).
const KEY_ZOOM_DELTA_PER_SECOND = 700;

// Same check as KeyboardNav.jsx's own (kept local rather than shared/exported
// to avoid a fast-refresh warning on a file that otherwise only exports a
// component).
function isTypingTarget(target) {
  if (!target) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

/**
 * Props:
 *  - url: panorama image URL for the current node
 *  - ready: optional — false while `url` is only transiently empty (the node changed and its
 *    real photo hasn't resolved yet). While false, the sphere holds whatever scene is already
 *    on screen instead of swapping to the "no image" placeholder, so a node with a real photo
 *    never flashes the placeholder on its way in. Defaults to true (url treated as final) for
 *    callers that don't have a separate loading state to report
 *  - hotspots: [{ id, name, yaw, pitch, photo }] — clickable arrows toward linked nodes; photo (optional) powers the hover sneak-peek
 *  - markers: [{ id, label, type, yaw, pitch }] — fixed point-of-interest labels, non-navigating
 *  - onNavigate(id): called when a hotspot is clicked
 *  - onMarkerClick(id): optional — called when a marker is clicked (admin editing only; omit for read-only display)
 *  - onError: called if the current panorama image fails to load
 *  - placing: bool — when true, clicking the panorama itself (not a hotspot/marker) reports the click angle
 *  - onPlaceAngle({yaw, pitch}): called when placing and the user clicks the sphere
 *  - highlightedId: optional neighbor id to render in a distinct color (used for directions)
 *  - selectedMarkerId: optional marker id to render with a highlight ring (admin editing)
 *  - highlightedMarkerId: optional marker id to glow as the route's next step (directions: an elevator landing whose ride is next) — also the autoPan target when no hotspot is highlighted
 *  - sceneKey: optional identity of the scene (e.g. the node id). When given, a change of scene keeps the previous panorama, hotspots and markers up until the new photo has loaded, then cross-fades and aims at initialYaw/initialPitch — so the parent should NOT remount PanoramaNav (no key=) to move between scenes. When omitted, a new url simply replaces the scene
 *  - aimKey: optional value that changes on every arrival (useNavigation's `arrival`). An arrival that keeps the same sceneKey (e.g. jumping to a room in the panorama already on screen) loads nothing new, so instead of the swap-in aim the view pans to the new initialYaw/initialPitch
 *  - heightFraction: optional 0-1 share of the window height the panorama's container fills (default 1) — only used to derive the right FOV
 *  - alwaysShowPreview: bool — kiosk view: every hotspot's photo preview is always shown, and a single tap navigates (no tap-to-preview step)
 *  - zoomable: bool — kiosk view: on-screen + / - / reset buttons zoom the panorama (no pinch), with a small level indicator; hidden along with the previews while previewsHidden
 *  - wheelZoomable: bool — desktop view: the mouse scroll wheel zooms the panorama, with the same small level indicator (shown only away from the default 1.0x)
 *  - autoPan: bool — directions: slowly turns the view to centre the highlighted hotspot (a drag by the visitor stops it until the next stop)
 *  - previewsHidden: bool — hides every hotspot preview (used while a menu/dialog is open over the panorama)
 *  - onRoomMarkerClick(marker): optional — called when a type:"room" marker is clicked (public viewer only; independent of onMarkerClick, which is for admin editing)
 *  - onElevatorMarkerClick(marker): optional — called when a type:"elevator" marker is clicked (public viewer only; independent of the props above — moves the visitor, unlike every other marker type, which is purely informational)
 *  - keyboardNav: bool — regular desktop view: WASD/arrow-key controls, Street-View-style (A/D or Left/Right pan, W/Up walks to the nearest hotspot currently on screen, S/Down calls onBack)
 *  - onBack: required when keyboardNav is true — called on S/Down
 *  - onLiveChange(live): optional — called whenever the target scene (sceneKey) finishes loading and
 *    actually becomes what's on screen (true), or a new move leaves it stale again (false). The
 *    authoritative "is the destination the only thing visible right now" signal — see `ready` above
 *    for the earlier, decode-only signal this follows
 *  - crossFade: bool (default true) — false swaps each newly loaded scene in outright instead of
 *    cross-fading from the previous one; for a scene arriving behind a full cover, where the fade
 *    would only expose the outgoing panorama
 *  - captureRequestId: optional — admin editors only. Bump this (any changing value) to capture the live camera's current yaw/pitch once, reported via onCaptureAngle; used to record a default/arrival view by orbiting to it and confirming, rather than clicking a point on the sphere
 *  - onCaptureAngle({yaw, pitch}): required when captureRequestId is used
 */
export default function PanoramaNav({
  url,
  ready = true,
  hotspots,
  markers = [],
  onNavigate,
  onMarkerClick,
  onRoomMarkerClick,
  onElevatorMarkerClick,
  onError,
  placing,
  onPlaceAngle,
  initialYaw = 0,
  initialPitch = 0,
  highlightedId = null,
  selectedMarkerId = null,
  highlightedMarkerId = null,
  sceneKey,
  aimKey,
  heightFraction = 1,
  alwaysShowPreview = false,
  previewsHidden = false,
  zoomable = false,
  wheelZoomable = false,
  autoPan = false,
  keyboardNav = false,
  onBack,
  captureRequestId,
  onCaptureAngle,
  onLiveChange,
  crossFade = true,
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
  const { zoom, setZoom, zoomByWheel } = useZoom();
  const zoomActive = zoomable || wheelZoomable;
  const fov = zoomActive ? zoomedFov(baseFov, zoom) : baseFov;

  // Native (non-passive) wheel listener: React's own onWheel is attached
  // passive by default, so e.preventDefault() inside it silently does
  // nothing and the page would scroll underneath the zoom. A plain
  // addEventListener with passive: false is the only way to actually stop
  // that while still zooming the panorama.
  const wrapRef = useRef(null);
  useEffect(() => {
    if (!wheelZoomable) return;
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      zoomByWheel(e.deltaY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [wheelZoomable, zoomByWheel]);

  // Desktop keyboard zoom: Shift zooms in, Control zooms out, continuously
  // while held (fed through the same zoomByWheel curve the scroll wheel
  // uses, via an equivalent deltaY-per-second, rather than a separate
  // step function) — see DesktopIntroOverlay.jsx, which documents this as
  // the keyboard alternative to the wheel. Same wheelZoomable gate as the
  // wheel listener above (desktop only; the kiosk's zoomable has its own
  // +/- buttons instead).
  useEffect(() => {
    if (!wheelZoomable) return;
    const dir = { current: 0 }; // -1 Shift (in), 1 Control (out)
    const onKeyDown = (e) => {
      if (isTypingTarget(e.target)) return;
      if (e.key === "Shift") dir.current = -1;
      else if (e.key === "Control") dir.current = 1;
    };
    const onKeyUp = (e) => {
      if (e.key === "Shift" && dir.current === -1) dir.current = 0;
      else if (e.key === "Control" && dir.current === 1) dir.current = 0;
    };
    const onBlur = () => {
      dir.current = 0;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    let raf;
    let last = performance.now();
    const tick = (now) => {
      const deltaSeconds = (now - last) / 1000;
      last = now;
      if (dir.current !== 0) zoomByWheel(dir.current * KEY_ZOOM_DELTA_PER_SECOND * deltaSeconds);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      cancelAnimationFrame(raf);
    };
  }, [wheelZoomable, zoomByWheel]);

  // Which url the texture load most recently failed for (a bad/corrupt file
  // — distinct from `url` never resolving, e.g. no photo assigned or the
  // fetch failing upstream). Comparing against the current `url` rather than
  // latching a plain boolean means a later move to a url that DOES load
  // clears it for free, with no separate reset effect needed.
  const [failedUrl, setFailedUrl] = useState(null);
  const photoFailed = !!url && failedUrl === url;
  // The node's real photo, or the bundled "NO IMAGE" panorama in its place —
  // the sphere always has something to paint, so the visitor can still pan
  // around and use hotspots exactly as with a real photo; only the wallpaper
  // is different. While `ready` is false, `url` being empty just means the
  // real photo hasn't resolved YET, not that there is no photo — passing
  // null keeps usePanoramaScene on whatever it's already showing (see its
  // `if (!url) return` bail) instead of swapping to the placeholder for one
  // node only to swap again to the real photo a moment later.
  const sceneUrl = !ready ? null : photoFailed || !url ? noImagePanorama : url;

  // What's actually on screen: see usePanoramaScene.
  const scene = usePanoramaScene({
    url: sceneUrl,
    sceneKey,
    hotspots,
    markers,
    initialYaw,
    initialPitch,
    crossFade,
    onError: () => {
      // Only the real photo failing is a failure to remember — if the
      // bundled placeholder itself somehow failed to load there would be
      // nothing left to fall back to, so don't loop back onto it.
      if (url) setFailedUrl(url);
      onError?.();
    },
  });
  const { shown, visible, leaving, live } = scene;

  // Reports the moment the target scene actually becomes what's on screen —
  // not when its bytes are merely decoded (that's `ready`/`url`, upstream),
  // but when usePanoramaScene's own texture load for THIS sceneKey has
  // finished and `shown` has caught up to it. A caller gating a full-cover
  // loading overlay on `ready` instead of this would hide the overlay the
  // instant the photo decodes, while the sphere is still mid-load on its
  // own separate GPU upload — exposing the outgoing node for that gap.
  const onLiveChangeRef = useRef(onLiveChange);
  useEffect(() => {
    onLiveChangeRef.current = onLiveChange;
  });
  // Re-reported on a scene change too, not just a `live` flip: a move made
  // before any scene has loaded stays live throughout (nothing to hold), and
  // the caller still needs to hear which scene that now means.
  useEffect(() => {
    onLiveChangeRef.current?.(live);
  }, [live, scene.sceneKey]);
  const highlightedHotspot = scene.hotspots.find((h) => h.id === highlightedId) || null;
  const highlightedMarker = scene.markers.find((m) => m.id === highlightedMarkerId) || null;
  const panTarget = highlightedHotspot || highlightedMarker;

  // An arrival that stays on the scene already on screen loads no texture,
  // so CameraAim never fires for it: pan to its entry view instead. Any
  // arrival elsewhere drops this, so it never pulls on a later scene (Back
  // onto this one included).
  const [aimedKey, setAimedKey] = useState(aimKey);
  const [reaim, setReaim] = useState(null);
  if (aimKey !== aimedKey) {
    setAimedKey(aimKey);
    const sameScene = scene.holdsScene && shown?.key === sceneKey;
    setReaim(sameScene ? { id: aimKey, yaw: initialYaw, pitch: initialPitch } : null);
  }

  // The Canvas is created once with the first scene's entry angle; later
  // scenes are aimed by CameraAim when they swap in.
  const [firstCameraPosition] = useState(() => initialCameraPosition(initialYaw, initialPitch));

  // W/Up found nothing to walk to: a brief "No location in front." toast,
  // auto-dismissed. Lives here (not in KeyboardNav) since it's DOM/CSS, not
  // a scene object.
  const [nothingAheadHint, setNothingAheadHint] = useState(false);
  const nothingAheadTimer = useRef(null);
  useEffect(() => () => clearTimeout(nothingAheadTimer.current), []);
  const flashNothingAhead = () => {
    setNothingAheadHint(true);
    clearTimeout(nothingAheadTimer.current);
    nothingAheadTimer.current = setTimeout(() => setNothingAheadHint(false), NOTHING_AHEAD_HINT_MS);
  };

  const canvas = (
    <Canvas camera={{ position: firstCameraPosition, fov: baseFov }} style={{ cursor }}>
      {zoomActive && <FovController fov={fov} />}
      {visible && <PanoramaSphere texture={visible.texture} placing={placing} onSurfaceClick={onPlaceAngle} />}
      {leaving && <FadingSphere key={leaving.uuid} texture={leaving} onDone={scene.dismissLeaving} />}
      {scene.holdsScene && shown && <CameraAim aimKey={shown.texture.uuid} yaw={shown.yaw} pitch={shown.pitch} />}
      {captureRequestId != null && <CaptureAngle requestId={captureRequestId} onCapture={onCaptureAngle} />}
      {autoPan && !placing && panTarget && (
        <AutoPan target={panTarget} targetKey={`${scene.sceneKey}:${panTarget.id}`} />
      )}
      {/* Directions' own pan wins: two pans at once would fight. */}
      {reaim && !placing && !(autoPan && panTarget) && <AutoPan target={reaim} targetKey={`reaim:${reaim.id}`} />}
      {keyboardNav && (
        <KeyboardNav
          hotspots={scene.hotspots}
          active={!placing && live}
          onNavigate={onNavigate}
          onBack={onBack}
          onNothingAhead={flashNothingAhead}
        />
      )}
      {scene.hotspots.map((h) => (
        <Hotspot
          // Scoped to the scene: a hotspot with the same target id in the
          // next scene is a new marker, not this one carried over with its
          // stale hover/clicked state.
          key={`${scene.sceneKey}:${h.id}`}
          yaw={h.yaw}
          pitch={h.pitch}
          label={h.name}
          photo={h.photo}
          dimmed={placing}
          highlighted={!placing && h.id === highlightedId}
          fov={fov}
          alwaysPreview={alwaysShowPreview && !placing}
          // Also hidden while a move is loading: `!live` means the screen is
          // still showing the scene being left.
          previewHidden={previewsHidden || !live}
          onClick={() =>
            !placing &&
            onNavigate(h.id, { yaw: h.yaw, pitch: h.pitch, defaultYaw: h.defaultYaw, defaultPitch: h.defaultPitch })
          }
        />
      ))}
      {scene.markers.map((m) => (
        <Marker
          key={m.id}
          yaw={m.yaw}
          pitch={m.pitch}
          label={m.label}
          type={m.type}
          dimmed={placing}
          selected={m.id === selectedMarkerId}
          highlighted={!placing && m.id === highlightedMarkerId}
          onClick={onMarkerClick && !placing ? () => onMarkerClick(m.id) : undefined}
          onRoomClick={onRoomMarkerClick && !placing ? () => onRoomMarkerClick(m) : undefined}
          onElevatorClick={onElevatorMarkerClick && !placing ? () => onElevatorMarkerClick(m) : undefined}
        />
      ))}
      <OrbitControls makeDefault enableDamping={false} enablePan={false} enableZoom={false} rotateSpeed={-(touchInput ? TOUCH_ROTATE_SPEED : MOUSE_ROTATE_SPEED)} target={[0, 0, 0]} />
    </Canvas>
  );

  return (
    <div className="pano-zoom-wrap" ref={wrapRef}>
      {canvas}
      {/* Hidden, like the hotspot previews, while a menu/dialog is open over the panorama. */}
      {zoomable && !previewsHidden && <ZoomControls zoom={zoom} setZoom={setZoom} />}
      {wheelZoomable && (
        <ZoomIndicator zoom={zoom} className="pano-zoom-indicator pano-wheel-zoom-indicator" />
      )}
      {nothingAheadHint && <div className="pano-nothing-ahead-hint">No location in front.</div>}
    </div>
  );
}
