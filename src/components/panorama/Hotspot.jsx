import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { toPosition, overlayScale, isFacing, previewScale } from "../../utils/panoramaMath";
import { previewShown, resolveHotspotClick } from "../../utils/hotspotPreview";
import { useHotspotPreview } from "../../hooks/useNodePhoto";
import { useIsCoarsePointer } from "./useIsCoarsePointer";

// Hotspots are drawn after (over) the panorama and its cross-fade sphere
// (renderOrder 1); the arrow inside a hotspot goes one step above its disc.
const HOTSPOT_RENDER_ORDER = 10;

// Gap between the hotspot ring and its preview card, as a share of the original.
const PREVIEW_GAP_FRACTION = 0.5;

// Period of the hotspot's outer-ring pulse.
const RING_PULSE_SECONDS = 2;

// A clickable wayfinding arrow toward a linked node, with a sneak-peek
// preview of where it leads. What the preview shows and when (facing,
// hover/tap, kiosk) is decided in utils/hotspotPreview.js and panoramaMath.js.
export function Hotspot({ yaw, pitch, label, photo, onClick, dimmed, highlighted, alwaysPreview, previewHidden, fov }) {
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
  const showPreview = previewShown({ previewHidden, clicked, facing, alwaysPreview, hovered });
  // Only fetches once the preview is actually shown — a hotspot that never
  // shows one never triggers a photo fetch at all. The preview looks the way
  // the visitor will be facing on arrival (this hotspot's yaw); null until it
  // is ready, so the spinner stays up and the flat 360° map never flashes.
  const previewUrl = useHotspotPreview(photo, yaw, showPreview);

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
    if (resolveHotspotClick({ isTouch, hovered, alwaysPreview }) === "peek") {
      setHovered(true); // tap-to-preview: show the sneak-peek, don't walk yet
      return;
    }
    setHovered(false);
    setClicked(true);
    onClick(); // tap-again-to-go (touch), or the only tap needed at all (mouse)
  };

  // 3D materials can't read CSS custom properties — these mirror the brand
  // tokens: --accent (SDCA maroon), --success, and --text-subtle for the
  // dimmed/placing state.
  const color = dimmed ? "#8c8180" : highlighted ? "#2e7d46" : "#a12124";
  // The arrow inside the hotspot always uses the design system's on-accent
  // contrast colour (--accent-contrast === #fff). White reads clearly on
  // every hotspot fill — maroon, success green and the
  // dimmed grey — and matches how the app already paints icons and text
  // that sit on an accent-coloured surface, so the arrow stays visually
  // tied to the hotspot rather than looking like a separate element.
  const arrowColor = "#ffffff";
  const groupRef = useRef();
  const pulseRef = useRef();
  const previewRef = useRef(); // the preview card; scaled every frame, see useFrame
  const cameraDir = useMemo(() => new THREE.Vector3(), []);
  const hotspotDir = useMemo(() => new THREE.Vector3(...toPosition(yaw, pitch)).normalize(), [yaw, pitch]);

  // The hotspot is a permanently-visible wayfinding marker now, not a
  // hover-only "sneak peek". Hover keeps a small emphasis bump and still
  // brings up the photo preview below.
  const dotOpacity = hovered ? 0.95 : 0.85;
  const ringOpacity = hovered ? 0.7 : 0.5;

  const dotRadius = highlighted ? 18 : 14;
  // Where the preview card's bottom edge sits above the hotspot: it used to be
  // 50 units up, i.e. (50 - ring radius) clear of the ring; the gap is now half
  // that. Raise PREVIEW_GAP_FRACTION for more space, lower it for less.
  const ringOuter = highlighted ? 26 : 20;
  const previewY = ringOuter + (50 - ringOuter) * PREVIEW_GAP_FRACTION;

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
    const lookDot = camera.getWorldDirection(cameraDir).dot(hotspotDir);
    const nowFacing = isFacing(lookDot);
    if (nowFacing !== facing) setFacing(nowFacing);
    // Preview card: big when looked at directly, smaller the further away
    // you look. Imperative (no re-render), anchored at the card's bottom
    // centre so it stays put above the marker.
    if (previewRef.current) previewRef.current.style.transform = `scale(${previewScale(lookDot)})`;
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
    groupRef.current.scale.setScalar(uiScale);
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

      {/* Flat disc + ring, billboarded (see useFrame) to face the camera.
          depthTest is off on everything drawn here (with a renderOrder above
          the panorama's cross-fade) because the marker sits only 20 units
          inside the panorama sphere: turned toward the camera, the far side
          of the disc/ring (the pulse ring especially) pokes outside that
          sphere as soon as you look well away from the hotspot, and the depth
          test then cut that part off. The marker is always meant to be in
          front of the image, so it never needs the test. */}
      <mesh renderOrder={HOTSPOT_RENDER_ORDER}>
        <circleGeometry args={[dotRadius, 40]} />
        <meshBasicMaterial color={color} transparent opacity={dotOpacity} depthWrite={false} depthTest={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh renderOrder={HOTSPOT_RENDER_ORDER}>
        <ringGeometry args={highlighted ? [20, 26, 40] : [16, 20, 40]} />
        <meshBasicMaterial color={color} transparent opacity={ringOpacity} side={THREE.DoubleSide} depthWrite={false} depthTest={false} />
      </mesh>
      {/* Extra ring copy that expands and fades (see useFrame); the static
          ring above stays put. */}
      <mesh ref={pulseRef} renderOrder={HOTSPOT_RENDER_ORDER}>
        <ringGeometry args={highlighted ? [20, 26, 40] : [16, 20, 40]} />
        <meshBasicMaterial color={color} transparent opacity={ringOpacity} side={THREE.DoubleSide} depthWrite={false} depthTest={false} />
      </mesh>

      {/* Flat white chevron sitting just in front of the disc. renderOrder
          keeps it painted over the disc. */}
      <mesh position={[0, 0, 0.5]} renderOrder={HOTSPOT_RENDER_ORDER + 1}>
        <shapeGeometry args={[arrowShape]} />
        <meshBasicMaterial color={arrowColor} transparent opacity={1} depthWrite={false} depthTest={false} side={THREE.DoubleSide} />
      </mesh>

      {/* Sneak-peek preview — on hover (or always, on the kiosk), a "check
          before you click" affordance separate from the marker itself. */}
      {showPreview && (
        <Html
          // No distanceFactor: the card is plain CSS pixels (sized in
          // index.css). With it, the card's size followed the camera's FOV
          // and came out at only ~0.2-0.4x of its CSS size.
          zIndexRange={[0, 0]} // stays under the page's own UI, like the marker overlays
          position={[0, previewY, 0]}
          // Anchor the card by its BOTTOM edge (translate -100% on Y), not
          // its middle. `center` would pin the card's centre to the anchor
          // and the now-large card would swallow the hotspot; bottom-anchored
          // it always sits fully above the marker no matter how tall the
          // card grows with a long label. previewY (see above) clears the
          // ring by a small gap; -50% on X keeps it
          // horizontally centred over the hotspot.
          style={{ pointerEvents: "none", transform: "translate(-50%, -100%)" }}
        >
          {/* Styling lives in index.css → "Panorama overlays" so it stays on
              the brand tokens; only the image src is dynamic here. */}
          <div className="pano-hotspot-preview" ref={previewRef}>
            <div className="pano-hotspot-preview-thumb">
              {previewUrl ? (
                <img src={previewUrl} alt={label} />
              ) : (
                <div className="loading-spinner" role="status" aria-label="Loading preview" />
              )}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}
