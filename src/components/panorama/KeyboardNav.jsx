import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { KEYBOARD_PAN_DEG_PER_SEC, toAngles, closestHotspotInView } from "../../utils/panoramaMath";

function isTypingTarget(target) {
  if (!target) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

// Desktop WASD/arrow-key control scheme, Street-View-style: A/D (or
// Left/Right) pan the view left/right while held; W/Up walks to whichever
// hotspot is closest to dead ahead AND actually visible on screen right
// now (see closestHotspotInView — one just out of frame doesn't count, and
// onNothingAhead fires instead); S/Down retraces the last step. Ignored
// while typing in a text field, and while `active` is false (e.g. the
// panorama is mid-move or placing).
export function KeyboardNav({ hotspots, active, onNavigate, onBack, onNothingAhead }) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls);
  const panDir = useRef(0); // -1 left (A), 1 right (D), 0 idle

  // Refs so the key handlers (attached once) always see the latest props
  // without re-binding on every render.
  const latest = useRef({ hotspots, active, onNavigate, onBack, onNothingAhead });
  useEffect(() => {
    latest.current = { hotspots, active, onNavigate, onBack, onNothingAhead };
  });

  useEffect(() => {
    const walkAhead = () => {
      const dir = camera.getWorldDirection(new THREE.Vector3());
      const { yaw, pitch } = toAngles(dir);
      // The camera's own actual FOV/aspect, so "in front" means "on
      // screen right now" rather than some fixed generous cone.
      const halfV = camera.fov / 2;
      const halfH = (Math.atan(Math.tan((camera.fov * Math.PI) / 360) * camera.aspect) * 180) / Math.PI;
      const best = closestHotspotInView(latest.current.hotspots, yaw, pitch, halfH, halfV);
      if (best) latest.current.onNavigate(best.id, { yaw: best.yaw, pitch: best.pitch });
      else latest.current.onNothingAhead();
    };

    const onKeyDown = (e) => {
      if (!latest.current.active || isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.code) {
        case "KeyA":
        case "ArrowLeft":
          panDir.current = -1;
          break;
        case "KeyD":
        case "ArrowRight":
          panDir.current = 1;
          break;
        case "KeyW":
        case "ArrowUp":
          walkAhead();
          break;
        case "KeyS":
        case "ArrowDown":
          latest.current.onBack();
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    const onKeyUp = (e) => {
      if (e.code === "KeyA" || e.code === "ArrowLeft") {
        if (panDir.current === -1) panDir.current = 0;
      } else if (e.code === "KeyD" || e.code === "ArrowRight") {
        if (panDir.current === 1) panDir.current = 0;
      }
    };
    // Losing focus (alt-tab, clicking another element) mid-hold shouldn't
    // leave the view panning forever with no keyup ever arriving.
    const onBlur = () => {
      panDir.current = 0;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [camera]);

  useFrame((_, delta) => {
    if (panDir.current === 0 || !controls || !latest.current.active) return;
    const dyaw = ((KEYBOARD_PAN_DEG_PER_SEC * Math.PI) / 180) * Math.min(delta, 0.1);
    // Yaw increases clockwise seen from above (panoramaMath.js); a camera
    // position at yaw sits opposite its view direction, so turning the
    // view clockwise (D, panDir 1) rotates the position the other way.
    camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), -panDir.current * dyaw);
    controls.update();
  });

  return null;
}
