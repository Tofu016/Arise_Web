import { useEffect, useRef, useState } from "react";
import { cropLayout } from "../utils/signage";

// One signage slide's media (image, GIF or looping, muted video), drawn so
// its crop fills this element's box (see cropLayout). Fills its parent,
// which sets the size. Shared by the kiosk band, the admin list's
// thumbnails and the editor's live preview, so all three always agree on
// what is visible.
//
// Nothing shows until both the box and the media's natural size are
// known, so the uncropped media never flashes; onReady fires at that point
// (the kiosk player waits for it before crossfading).
export default function SignageMedia({ src, video, crop, onReady, onMediaInfo, className = "" }) {
  const boxRef = useRef(null);
  const [box, setBox] = useState(null);
  const [media, setMedia] = useState(null);
  const ready = !!(box && media);

  // Media size belongs to the src it was read from; a new src starts over.
  const [mediaSrc, setMediaSrc] = useState(src);
  if (mediaSrc !== src) {
    setMediaSrc(src);
    setMedia(null);
  }

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBox(width > 0 && height > 0 ? { width, height } : null);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (ready) onReady?.();
    // Only the transition to ready matters, not a new onReady identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, src]);

  const handleSize = (width, height, duration) => {
    if (!width || !height) return;
    setMedia({ width, height });
    onMediaInfo?.({ width, height, duration });
  };

  let style = { visibility: "hidden" };
  if (ready) {
    const layout = cropLayout(crop, media.width, media.height, box.width, box.height);
    style = { left: layout.left, top: layout.top, width: layout.width, height: layout.height };
  }

  return (
    <div ref={boxRef} className={`signage-media${className ? ` ${className}` : ""}`}>
      {video ? (
        <video
          key={src}
          src={src}
          className="signage-media-el"
          style={style}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          onLoadedMetadata={(e) => handleSize(e.target.videoWidth, e.target.videoHeight, e.target.duration)}
        />
      ) : (
        <img
          key={src}
          src={src}
          alt=""
          className="signage-media-el"
          style={style}
          draggable={false}
          onLoad={(e) => handleSize(e.target.naturalWidth, e.target.naturalHeight, null)}
        />
      )}
    </div>
  );
}
