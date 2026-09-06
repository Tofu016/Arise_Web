import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

// Loads the equirectangular image manually (rather than useLoader/Suspense) so a
// missing file reports a clean onError callback instead of throwing into a Suspense
// boundary — keeps this consistent with how the rest of the admin tool already
// detects "no photo yet" (see PreviewTour's old <img onError> approach).
function PanoramaSphere({ url, onLoaded, onError }) {
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

  // Sphere is inverted (negative X scale) so the texture renders on the inside
  // face, with the camera sitting at the center looking outward — the standard
  // "photo sphere" technique.
  return (
    <mesh scale={[-1, 1, 1]}>
      <sphereGeometry args={[500, 60, 40]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} />
    </mesh>
  );
}

/**
 * Props:
 *  - url: image URL (e.g. "/panoramas/gd1_f1_hallway_01.jpg")
 *  - onError: called if the image fails to load (missing file)
 */
export default function Panorama360({ url, onError }) {
  return (
    <Canvas camera={{ position: [0, 0, 0.1], fov: 75 }}>
      <PanoramaSphere url={url} onError={onError} />
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        rotateSpeed={-0.4}
        target={[0, 0, 0]}
      />
    </Canvas>
  );
}
