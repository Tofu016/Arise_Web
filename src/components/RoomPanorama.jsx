import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { initialCameraPosition } from "../utils/panoramaMath";
import { PanoramaSphere } from "./panorama/Spheres";
import { TOUCH_ROTATE_SPEED, MOUSE_ROTATE_SPEED } from "./panorama/cameraSettings";
import { useIsCoarsePointer } from "./panorama/useIsCoarsePointer";
import { useSecurePhotoUrl } from "../hooks/useSecurePhotoUrl";
import PhotoLoading from "./PhotoLoading";
import handIcon from "../assets/icons/hand-pointing-white.svg";

const FOV = 75;
const START_POSITION = initialCameraPosition(0, 0);

// A room's 360 photo to look around in, dragged the same way as the main
// panorama (same rotate speeds, no pan, no zoom). Fills its parent. `hint`
// plays the drag animation once over it; `onHintDone` fires when it ends or
// the visitor first drags, so a caller can play it only for the first 360
// photo it shows.
export function RoomPanorama({ url, hint = false, onHintDone, alt }) {
  const touchInput = useIsCoarsePointer();
  const [texture, setTexture] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let loaded = null;
    new THREE.TextureLoader().load(
      url,
      (tex) => {
        if (cancelled) {
          tex.dispose();
          return;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        loaded = tex;
        setTexture(tex);
      },
      undefined,
      () => {
        if (!cancelled) setFailed(true);
      }
    );
    return () => {
      cancelled = true;
      loaded?.dispose();
    };
  }, [url]);

  if (failed) return <div className="room-pano-status">Couldn't load photo.</div>;
  if (!texture) return <div className="room-pano-status"><PhotoLoading /></div>;

  return (
    <div className="room-pano" role="img" aria-label={alt} onPointerDownCapture={() => onHintDone?.()}>
      <Canvas camera={{ position: START_POSITION, fov: FOV }}>
        <PanoramaSphere texture={texture} />
        <OrbitControls
          makeDefault
          enableDamping={false}
          enablePan={false}
          enableZoom={false}
          rotateSpeed={-(touchInput ? TOUCH_ROTATE_SPEED : MOUSE_ROTATE_SPEED)}
          target={[0, 0, 0]}
        />
      </Canvas>
      {hint && <DragHint onDone={onHintDone} />}
    </div>
  );
}

// A hand sweeping left and right: the view can be dragged. Three sweeps,
// then it removes itself.
export function DragHint({ onDone }) {
  return (
    <div className="room-pano-hint" aria-hidden="true" onAnimationEnd={(e) => e.target === e.currentTarget && onDone?.()}>
      <img src={handIcon} alt="" className="room-pano-hint-hand" />
    </div>
  );
}

// RoomPanorama for a photo path, fetching it first (through the session
// cache the room's carousel already warms).
export default function PanoramaPhoto({ path, ...props }) {
  const { url, error } = useSecurePhotoUrl(path, { cached: true });
  if (error) return <div className="room-pano-status">Couldn't load photo.</div>;
  if (!url) return <div className="room-pano-status"><PhotoLoading /></div>;
  return <RoomPanorama url={url} {...props} />;
}

// The "360°" badge: a plain label over a photo, or a button when `onClick`
// is given (the kiosk, where it opens the photo).
export function Pano360Pill({ onClick, className = "" }) {
  const cls = `pano-360-pill ${className}`.trim();
  if (!onClick) return <span className={cls}>360°</span>;
  return (
    <button type="button" className={cls} onClick={onClick} aria-label="View in 360 degrees">
      360°
    </button>
  );
}
