import { useEffect, useRef, useState } from "react";
import { moveCrop, resizeCrop, scaleCrop } from "../../utils/signage";

const HANDLES = ["nw", "ne", "sw", "se"];
// Tallest the media is drawn, so a portrait photo doesn't push the rest of
// the editor off screen.
const MAX_STAGE_HEIGHT = 300;
const NUDGE = 0.01;
const NUDGE_FAST = 0.05;
const ZOOM_STEP = 1.1;

// The crop editor: the whole media, with a band-shaped box marking what the
// kiosk will show and everything outside it dimmed. Drag the box to move
// it, drag a corner to zoom (the box keeps the band's shape), or focus it
// and use the arrow keys (Shift for bigger steps) and + / - to zoom.
//
// `crop` is null until the parent knows the media's shape (reported
// through onMediaInfo once it loads) and has picked a starting crop.
export default function SignageCropper({ src, video, crop, mediaAspect, targetAspect, onChange, onMediaInfo }) {
  const wrapRef = useRef(null);
  const overlayRef = useRef(null);
  const drag = useRef(null);
  const [wrapWidth, setWrapWidth] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(([entry]) => setWrapWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  let stageStyle;
  if (mediaAspect && wrapWidth) {
    const width = Math.min(wrapWidth, MAX_STAGE_HEIGHT * mediaAspect);
    stageStyle = { width, height: width / mediaAspect };
  }

  const startDrag = (e, mode, handle = null) => {
    if (!crop || e.button > 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      mode,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startCrop: crop,
      rect: overlayRef.current.getBoundingClientRect(),
    };
  };

  const onDragMove = (e) => {
    const d = drag.current;
    if (!d) return;
    if (d.mode === "move") {
      onChange(moveCrop(d.startCrop, (e.clientX - d.startX) / d.rect.width, (e.clientY - d.startY) / d.rect.height));
    } else {
      const point = { x: (e.clientX - d.rect.left) / d.rect.width, y: (e.clientY - d.rect.top) / d.rect.height };
      onChange(resizeCrop(d.startCrop, d.handle, point, mediaAspect, targetAspect));
    }
  };

  const endDrag = () => {
    drag.current = null;
  };

  const onKeyDown = (e) => {
    if (!crop) return;
    const step = e.shiftKey ? NUDGE_FAST : NUDGE;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      onChange(moveCrop(crop, ...moves[e.key]));
    } else if (e.key === "+" || e.key === "=") {
      onChange(scaleCrop(crop, 1 / ZOOM_STEP, mediaAspect, targetAspect));
    } else if (e.key === "-" || e.key === "_") {
      onChange(scaleCrop(crop, ZOOM_STEP, mediaAspect, targetAspect));
    } else {
      return;
    }
    e.preventDefault();
  };

  const mediaProps = {
    src,
    className: "signage-cropper-media",
    draggable: false,
  };

  return (
    <div ref={wrapRef} className="signage-cropper">
      <div className="signage-cropper-stage" style={stageStyle}>
        {video ? (
          <video
            {...mediaProps}
            autoPlay
            muted
            loop
            playsInline
            onLoadedMetadata={(e) =>
              onMediaInfo({ width: e.target.videoWidth, height: e.target.videoHeight, duration: e.target.duration })
            }
          />
        ) : (
          <img
            {...mediaProps}
            alt="The uploaded advertisement"
            onLoad={(e) => onMediaInfo({ width: e.target.naturalWidth, height: e.target.naturalHeight, duration: null })}
          />
        )}
        {crop && (
          <div ref={overlayRef} className="signage-cropper-overlay">
            <div
              className="signage-cropper-box"
              style={{
                left: `${crop.x * 100}%`,
                top: `${crop.y * 100}%`,
                width: `${crop.w * 100}%`,
                height: `${crop.h * 100}%`,
              }}
              tabIndex={0}
              role="group"
              aria-label="Visible area. Drag to move, or use the arrow keys. Plus and minus zoom."
              onPointerDown={(e) => startDrag(e, "move")}
              onPointerMove={onDragMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onKeyDown={onKeyDown}
            >
              <span className="signage-cropper-label">Shown on the kiosk</span>
              {HANDLES.map((h) => (
                <span
                  key={h}
                  className={`signage-cropper-handle signage-cropper-handle--${h}`}
                  onPointerDown={(e) => startDrag(e, "resize", h)}
                  onPointerMove={onDragMove}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
