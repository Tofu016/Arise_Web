import { useEffect, useState } from "react";
import { projectRectilinear } from "../utils/rectilinear";

// Turns a node's equirectangular photo URL into a normal-looking preview
// (a rectilinear crop looking along `yaw`) as a data URL. Returns
// { url, failed }: url is null while it works; failed turns true if it can't
// be made (e.g. a cross-origin photo that taints the canvas), and only then
// should callers fall back to the raw photo — never while it's still working,
// or the flat equirectangular image flashes up.

const SOURCE_WIDTH = 2048; // equirect is downscaled to this before sampling
const OUT_WIDTH = 288;
const OUT_HEIGHT = 180;
const FOV = 80; // horizontal degrees — reads as a natural photo

const sourceCache = new Map(); // url -> Promise<{data,width,height}>
const previewCache = new Map(); // key -> data URL
const failedKeys = new Set();
const SOURCE_CACHE_MAX = 8;

// One projection at a time, so several hotspots appearing together don't
// stall the main thread with simultaneous decodes.
let queue = Promise.resolve();

function loadSource(url) {
  if (sourceCache.has(url)) return sourceCache.get(url);
  const promise = new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const width = Math.min(SOURCE_WIDTH, img.naturalWidth);
      const height = Math.round(width / 2);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      try {
        resolve({ data: ctx.getImageData(0, 0, width, height).data, width, height });
      } catch (err) {
        reject(err); // tainted canvas
      }
    };
    img.onerror = () => reject(new Error("photo failed to load"));
    img.src = url;
  });
  sourceCache.set(url, promise);
  if (sourceCache.size > SOURCE_CACHE_MAX) sourceCache.delete(sourceCache.keys().next().value);
  promise.catch(() => sourceCache.delete(url));
  return promise;
}

async function render(url, yaw) {
  const src = await loadSource(url);
  const pixels = projectRectilinear(src, { yaw, pitch: 0, fov: FOV, width: OUT_WIDTH, height: OUT_HEIGHT });
  const canvas = document.createElement("canvas");
  canvas.width = OUT_WIDTH;
  canvas.height = OUT_HEIGHT;
  canvas.getContext("2d").putImageData(new ImageData(pixels, OUT_WIDTH, OUT_HEIGHT), 0, 0);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function useRectilinearPreview(photoUrl, rawYaw) {
  // The backend can hand angles back as strings ("123.5"), so coerce.
  const yaw = Number(rawYaw);
  // Blob URLs are per-load, so key on the URL itself.
  const key = photoUrl && Number.isFinite(yaw) ? `${photoUrl}|${Math.round(yaw)}` : null;
  // The result is stored with its key, so a stale one is never returned for
  // a different photo/angle.
  const [done, setDone] = useState({ key: null, url: null, failed: false });

  useEffect(() => {
    if (!key || previewCache.has(key) || failedKeys.has(key)) return;
    let cancelled = false;
    queue = queue.then(async () => {
      if (cancelled) return;
      try {
        const dataUrl = await render(photoUrl, yaw);
        previewCache.set(key, dataUrl);
        if (!cancelled) setDone({ key, url: dataUrl, failed: false });
      } catch (err) {
        // the caller falls back to the raw photo
        console.warn("Hotspot preview projection failed:", err);
        failedKeys.add(key);
        if (!cancelled) setDone({ key, url: null, failed: true });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [key, photoUrl, yaw]);

  if (!key) return { url: null, failed: false };
  const url = previewCache.get(key) ?? (done.key === key ? done.url : null);
  return { url, failed: !url && failedKeys.has(key) };
}
