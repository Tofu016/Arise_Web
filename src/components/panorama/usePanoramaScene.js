import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { resolveScene } from "../../utils/panoramaScene";

// Loads each scene's texture and decides what is on screen (see
// utils/panoramaScene.js). Returns the resolved scene plus:
//   shown / visible   the last loaded scene, and the part of it to draw
//   leaving           the texture being replaced, mid cross-fade
//   dismissLeaving()  called when that fade is done
// `crossFade: false` swaps the new texture in outright instead — for a scene
// arriving behind a cover, where fading from the old one would only expose it.
// Owns the GPU memory of every texture it loaded.
export function usePanoramaScene({ url, sceneKey, hotspots, markers, initialYaw, initialPitch, crossFade = true, onError }) {
  const holdsScene = sceneKey !== undefined;
  const key = sceneKey ?? url;
  const [shown, setShown] = useState(null);
  const [leaving, setLeaving] = useState(null);
  const shownRef = useRef(null);
  const leavingRef = useRef(null);
  const latest = useRef({ hotspots, markers, initialYaw, initialPitch, crossFade, onError });
  useEffect(() => {
    latest.current = { hotspots, markers, initialYaw, initialPitch, crossFade, onError };
  });

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
        const { hotspots: hs, markers: ms, initialYaw: yaw, initialPitch: pitch, crossFade: fade } = latest.current;
        const previous = shownRef.current;
        shownRef.current = { key, texture: tex, hotspots: hs, markers: ms, yaw, pitch };
        leavingRef.current?.dispose(); // a fade still running when another move lands
        const keepsPrevious = holdsScene && fade;
        leavingRef.current = keepsPrevious ? previous?.texture ?? null : null;
        if (!keepsPrevious) previous?.texture.dispose();
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

  const dismissLeaving = () => {
    leavingRef.current?.dispose();
    leavingRef.current = null;
    setLeaving(null);
  };

  return { ...resolveScene({ holdsScene, key, shown, hotspots, markers }), holdsScene, shown, leaving, dismissLeaving };
}
