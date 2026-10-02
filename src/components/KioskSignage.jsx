import { useEffect, useState } from "react";
import SignageMedia from "./SignageMedia";
import { publicPhotoUrl } from "../utils/photoStore";
import { isVideoPath, rotationPass } from "../utils/signage";

// Matches .kiosk-signage-layer--fade's transition in index.css.
const FADE_MS = 800;

// A fresh rotation: the first pass, showing its first slide. Up to two
// layers are kept, the slide leaving (underneath) and the one arriving;
// `serial` keys each showing, so the same slide shown again still remounts
// and replays from the start.
function startRotation(signature, count, order) {
  const pass = rotationPass(count, order);
  return {
    signature,
    pass,
    pos: 0,
    serial: 0,
    layers: count > 0 ? [{ serial: 0, index: pass[0] }] : [],
    readySerial: -1,
  };
}

function advance(rot, order) {
  let { pass, pos } = rot;
  pos += 1;
  if (pos >= pass.length) {
    pass = rotationPass(pass.length, order, pass[pass.length - 1]);
    pos = 0;
  }
  const serial = rot.serial + 1;
  return { ...rot, pass, pos, serial, layers: [...rot.layers.slice(-1), { serial, index: pass[pos] }] };
}

// The signage rotation (see utils/signage.js) in whatever box it's put in:
// the kiosk's bottom band, or the admin page's live preview. Each slide
// shows for its own duration, then the next fades (or cuts) in over it
// once its media is actually ready, so a slow load never shows a blank.
// One slide just stays; a video loops for as long as it is up.
//
// Renders nothing with no slides, which leaves the band its plain white.
export default function KioskSignage({ slides, settings, className = "" }) {
  const order = settings?.rotationOrder ?? "sequence";
  const fade = (settings?.transition ?? "fade") === "fade";

  // The rotation restarts only when what it shows changes, not each time
  // the kiosk re-reads an identical list (new objects, same content).
  const signature = JSON.stringify([order, slides.map((s) => [s.id, s.mediaPath, s.crop, s.durationSeconds])]);
  const [rot, setRot] = useState(() => startRotation(signature, slides.length, order));
  if (rot.signature !== signature) {
    setRot(startRotation(signature, slides.length, order));
  }

  const current = rot.layers[rot.layers.length - 1];
  const currentDuration = current ? slides[current.index]?.durationSeconds : null;

  useEffect(() => {
    if (slides.length < 2 || !currentDuration) return undefined;
    const timer = setTimeout(() => setRot((r) => advance(r, order)), currentDuration * 1000);
    return () => clearTimeout(timer);
    // One timer per showing: rot.serial changes exactly when a new slide
    // arrives, and signature when the rotation restarts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rot.signature, rot.serial]);

  // Once the arriving slide has faded in, drop the one underneath: a video
  // there would keep decoding unseen, and a transparent PNG or GIF on top
  // would show the previous slide through it.
  const settled = rot.layers.length > 1 && rot.readySerial >= rot.serial;
  useEffect(() => {
    if (!settled) return undefined;
    const timer = setTimeout(
      () => setRot((r) => (r.layers.length > 1 ? { ...r, layers: r.layers.slice(-1) } : r)),
      fade ? FADE_MS + 100 : 0
    );
    return () => clearTimeout(timer);
  }, [settled, fade]);

  if (rot.layers.length === 0) return null;

  return (
    <div className={`kiosk-signage${className ? ` ${className}` : ""}`} aria-hidden="true">
      {rot.layers.map((layer, i) => {
        const slide = slides[layer.index];
        if (!slide) return null;
        const arriving = i === rot.layers.length - 1;
        const shown = !arriving || rot.readySerial >= layer.serial;
        return (
          <div
            key={layer.serial}
            className={
              "kiosk-signage-layer" +
              (shown ? " kiosk-signage-layer--shown" : "") +
              (fade ? " kiosk-signage-layer--fade" : "")
            }
          >
            <SignageMedia
              src={publicPhotoUrl(slide.mediaPath)}
              video={isVideoPath(slide.mediaPath)}
              crop={slide.crop}
              onReady={() => setRot((r) => (r.readySerial >= layer.serial ? r : { ...r, readySerial: layer.serial }))}
            />
          </div>
        );
      })}
    </div>
  );
}
