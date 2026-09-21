import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { toPosition, initialCameraPosition, autoPanStep } from "../../utils/panoramaMath";

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
// is centred. Eases out (speed follows the remaining angle) between a floor
// and a ceiling in degrees per second, so it stays gentle. A drag by the
// visitor hands control back until the target changes (a new stop or scene).
export function AutoPan({ target, targetKey }) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls);
  const overridden = useRef(false);
  const scratch = useMemo(() => ({ look: new THREE.Vector3(), want: new THREE.Vector3(), axis: new THREE.Vector3() }), []);

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
    const { look, want, axis } = scratch;
    camera.getWorldDirection(look);
    want.set(...toPosition(target.yaw, target.pitch)).normalize();
    const step = autoPanStep(look.angleTo(want), delta); // 0 once centred
    if (step === 0) return;
    axis.crossVectors(look, want);
    if (axis.lengthSq() < 1e-8) axis.set(0, 1, 0); // facing directly away: any turn will do
    axis.normalize();
    camera.position.applyAxisAngle(axis, step); // the camera sits opposite its view direction
    controls.update();
  });
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
