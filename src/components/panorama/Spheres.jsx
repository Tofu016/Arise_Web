import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { toAngles } from "../../utils/panoramaMath";

export function PanoramaSphere({ texture, onSurfaceClick, placing }) {
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
export function FadingSphere({ texture, onDone }) {
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
