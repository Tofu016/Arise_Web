import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { toAngles, initialCameraPosition, autoPanToward } from "../../utils/panoramaMath";

// Aims the camera at the entry direction of a newly swapped-in scene. The
// Canvas outlives moves, so this can't rely on the camera's initial position.
export function CameraAim({ aimKey, yaw, pitch }) {
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

// Directions: slowly turns the view until `target` (a hotspot's yaw/pitch)
// is centred, along a straight line in yaw/pitch (see autoPanToward). Eases out
// (speed follows the remaining angle) between a floor and a ceiling in degrees
// per second, so it stays gentle. A drag by the visitor hands control back
// until the target changes (a new stop or scene).
export function AutoPan({ target, targetKey }) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls);
  const overridden = useRef(false);
  const look = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    overridden.current = false;
  }, [targetKey]);

  useEffect(() => {
    if (!controls) return;
    const onStart = () => { overridden.current = true; };
    controls.addEventListener("start", onStart);
    return () => controls.removeEventListener("start", onStart);
  }, [controls]);

  useFrame((_, delta) => {
    if (!target || overridden.current || !controls) return;
    camera.getWorldDirection(look);
    const next = autoPanToward(toAngles(look), target, delta);
    if (!next) return;
    // the camera sits opposite its view direction, at its current distance
    camera.position.set(...initialCameraPosition(next.yaw, next.pitch, camera.position.length()));
    controls.update();
  });
  return null;
}

// Captures the live camera's look direction as yaw/pitch on demand: bumping
// `requestId` (any changing value) fires `onCapture({yaw, pitch})` once,
// reading whatever the camera is aimed at right then — used by the admin
// editors to record "this is the view I've orbited to" (a default/arrival
// view), as opposed to CameraAim, which drives the camera the other way.
export function CaptureAngle({ requestId, onCapture }) {
  const camera = useThree((state) => state.camera);
  const last = useRef(requestId);
  useEffect(() => {
    if (requestId == null || last.current === requestId) return;
    last.current = requestId;
    const direction = camera.getWorldDirection(new THREE.Vector3());
    onCapture(toAngles(direction));
  }, [requestId, camera, onCapture]);
  return null;
}

// Applies the zoomed FOV to the live camera every frame. Done here rather
// than through <Canvas camera>, whose reactive re-apply also resets the
// camera position (the view direction) on every FOV change.
export function FovController({ fov }) {
  useFrame(({ camera }) => {
    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}

// Reports whether the view has held still (no turn, no zoom) for `delayMs`,
// for previews that open on their own once the visitor stops to look (the
// Mobile web layout, which has no hover). Goes false on the first frame the
// view moves, and on a new scene (`sceneKey`), so a preview never opens over
// a view that only just arrived.
const SETTLE_ANGLE_RAD = 1e-4;
const SETTLE_FOV_DEG = 1e-3;
export function ViewSettleWatcher({ delayMs, sceneKey, onChange }) {
  const camera = useThree((state) => state.camera);
  const track = useRef({ quaternion: new THREE.Quaternion(), fov: 0, movedAt: 0, settled: false, sceneKey });
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  useFrame(({ clock }) => {
    const t = track.current;
    const now = clock.elapsedTime * 1000;
    const moved =
      t.sceneKey !== sceneKey ||
      t.quaternion.angleTo(camera.quaternion) > SETTLE_ANGLE_RAD ||
      Math.abs(camera.fov - t.fov) > SETTLE_FOV_DEG;
    if (moved) {
      t.quaternion.copy(camera.quaternion);
      t.fov = camera.fov;
      t.sceneKey = sceneKey;
      t.movedAt = now;
      if (t.settled) {
        t.settled = false;
        onChangeRef.current(false);
      }
    } else if (!t.settled && now - t.movedAt >= delayMs) {
      t.settled = true;
      onChangeRef.current(true);
    }
  });
  return null;
}
