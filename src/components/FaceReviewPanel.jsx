import { useEffect, useMemo, useRef, useState } from "react";

// Cheap, dependency-free pixelation: averages each small block of pixels in
// the region and fills the block with that average color. Effective enough
// to obscure a face at the resolution a manually-marked region typically
// is, without needing any external image-processing library.
//
// The block size scales with the region (about 4 blocks across its shorter
// side) because a fixed size is relative to the full-resolution panorama:
// a face drawn on a multi-thousand-pixel image spans so many 12px blocks
// that it stayed faintly recognizable.
const MIN_BLOCK_SIZE = 12;
const BLOCKS_ACROSS_REGION = 4;

function pixelateRegion(ctx, x, y, w, h, blockSize) {
  if (w <= 0 || h <= 0) return;
  blockSize = blockSize ?? Math.max(MIN_BLOCK_SIZE, Math.ceil(Math.min(w, h) / BLOCKS_ACROSS_REGION));
  const imageData = ctx.getImageData(x, y, w, h);
  const { data, width, height } = imageData;

  for (let by = 0; by < height; by += blockSize) {
    for (let bx = 0; bx < width; bx += blockSize) {
      let r = 0, g = 0, b = 0, count = 0;
      for (let dy = 0; dy < blockSize && by + dy < height; dy++) {
        for (let dx = 0; dx < blockSize && bx + dx < width; dx++) {
          const idx = ((by + dy) * width + (bx + dx)) * 4;
          r += data[idx];
          g += data[idx + 1];
          b += data[idx + 2];
          count++;
        }
      }
      r = Math.round(r / count);
      g = Math.round(g / count);
      b = Math.round(b / count);
      for (let dy = 0; dy < blockSize && by + dy < height; dy++) {
        for (let dx = 0; dx < blockSize && bx + dx < width; dx++) {
          const idx = ((by + dy) * width + (bx + dx)) * 4;
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
        }
      }
    }
  }
  ctx.putImageData(imageData, x, y);
}

// Rewritten to remove the automatic detectFaces Cloud Function entirely —
// no replacement API call, since the client specifically chose manual
// blurring over any automated alternative (client-side or otherwise).
// Genuinely more of a deletion than a rewrite: the canvas drawing, the
// click-and-drag manual region marking, and pixelateRegion itself were
// ALL already pure client-side code with zero Firebase involvement —
// only the "scan and find faces automatically" step is gone. Every admin
// action is now manual by design, not a fallback for when detection
// fails.
//
// storagePath is still accepted as a prop (NodeForm.jsx's existing call
// site passes it) but genuinely unused now — there's nothing left to
// download-and-scan server-side, so removing the prop from the caller
// isn't necessary; an unused prop is harmless.
const PREVIEW_WIDTH = 880;
const MAX_ZOOM = 8;
const ZOOM_STEP = 1.5;
const REGION_COLOR = "#4a9eff";
const REGION_HOVER_COLOR = "#ff9f1c";

export default function FaceReviewPanel({ imageBlob, storagePath: _storagePath, onConfirm, onCancel }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const [naturalSize, setNaturalSize] = useState(null);
  // Manually drawn regions — always blurred, no accept/reject toggle,
  // just remove if drawn by mistake. Stored in {x,y,width,height} shape,
  // in NATURAL image pixels.
  const [manualBoxes, setManualBoxes] = useState([]);
  // The box currently being dragged out, in NATURAL image pixels (so it
  // stays put if the view changes mid-drag) — null when not actively drawing.
  const [drawing, setDrawing] = useState(null);
  // Zoom factor (1 = whole photo) and the top-left corner of the visible
  // window in natural pixels. The window keeps the photo's aspect ratio, so
  // it maps onto the canvas without distortion.
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  // Region the admin is pointing at (chip or canvas), so a numbered chip
  // and its box can be matched at a glance.
  const [hoverIndex, setHoverIndex] = useState(null);
  const panRef = useRef(null);
  const [error, setError] = useState("");
  const [applying, setApplying] = useState(false);

  const imageUrl = useMemo(() => URL.createObjectURL(imageBlob), [imageBlob]);
  useEffect(() => () => URL.revokeObjectURL(imageUrl), [imageUrl]);

  const clampView = (v, size) => {
    const zoom = Math.min(MAX_ZOOM, Math.max(1, v.zoom));
    return {
      zoom,
      x: Math.min(size.width - size.width / zoom, Math.max(0, v.x)),
      y: Math.min(size.height - size.height / zoom, Math.max(0, v.y)),
    };
  };

  // Zooms about the center of the current window.
  const zoomBy = (factor) => {
    if (!naturalSize) return;
    setView((v) => {
      const cx = v.x + naturalSize.width / v.zoom / 2;
      const cy = v.y + naturalSize.height / v.zoom / 2;
      const zoom = Math.min(MAX_ZOOM, Math.max(1, v.zoom * factor));
      return clampView(
        { zoom, x: cx - naturalSize.width / zoom / 2, y: cy - naturalSize.height / zoom / 2 },
        naturalSize
      );
    });
  };
  const resetZoom = () => setView({ zoom: 1, x: 0, y: 0 });

  // Draws the visible window of the image + numbered regions + the
  // in-progress drag rectangle onto the preview canvas. The window is
  // sampled from the full-resolution image, so zooming shows real detail.
  useEffect(() => {
    if (!naturalSize || !canvasRef.current || !imgRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const visW = naturalSize.width / view.zoom;
    const visH = naturalSize.height / view.zoom;
    const sx = canvas.width / visW;
    const sy = canvas.height / visH;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imgRef.current, view.x, view.y, visW, visH, 0, 0, canvas.width, canvas.height);

    manualBoxes.forEach((b, i) => {
      const hot = i === hoverIndex;
      const color = hot ? REGION_HOVER_COLOR : REGION_COLOR;
      const x = (b.x - view.x) * sx;
      const y = (b.y - view.y) * sy;
      ctx.fillStyle = hot ? "rgba(255, 159, 28, 0.22)" : "rgba(74, 158, 255, 0.12)";
      ctx.fillRect(x, y, b.width * sx, b.height * sy);
      ctx.strokeStyle = color;
      ctx.lineWidth = hot ? 3 : 2;
      ctx.strokeRect(x, y, b.width * sx, b.height * sy);

      // Number badge on the box's top-left corner, constant on-screen size.
      const label = String(i + 1);
      ctx.font = "bold 14px sans-serif";
      const bw = Math.max(20, ctx.measureText(label).width + 10);
      const bh = 20;
      const by = y >= bh ? y - bh : y;
      ctx.fillStyle = color;
      ctx.fillRect(x, by, bw, bh);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x + bw / 2, by + bh / 2 + 1);
    });

    if (drawing) {
      ctx.strokeStyle = REGION_COLOR;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(
        (Math.min(drawing.startX, drawing.curX) - view.x) * sx,
        (Math.min(drawing.startY, drawing.curY) - view.y) * sy,
        Math.abs(drawing.curX - drawing.startX) * sx,
        Math.abs(drawing.curY - drawing.startY) * sy
      );
      ctx.setLineDash([]);
    }
  }, [naturalSize, manualBoxes, drawing, view, hoverIndex]);

  const handleImgLoad = () => {
    const img = imgRef.current;
    setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
  };

  const removeManualBox = (i) => {
    setHoverIndex(null);
    setManualBoxes((mb) => mb.filter((_, idx) => idx !== i));
  };

  // Converts a mouse event into NATURAL image pixels. The canvas's CSS size
  // differs from its drawing-surface resolution and the visible window may
  // be zoomed, so both are accounted for.
  const getImageCoords = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: view.x + ((e.clientX - rect.left) / rect.width) * (naturalSize.width / view.zoom),
      y: view.y + ((e.clientY - rect.top) / rect.height) * (naturalSize.height / view.zoom),
    };
  };

  const regionAt = (p) => {
    for (let i = manualBoxes.length - 1; i >= 0; i--) {
      const b = manualBoxes[i];
      if (p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height) return i;
    }
    return null;
  };

  const handleMouseDown = (e) => {
    if (!naturalSize) return;
    // Right button pans, left button marks a region.
    if (e.button === 2) {
      e.preventDefault();
      panRef.current = { clientX: e.clientX, clientY: e.clientY };
      return;
    }
    if (e.button !== 0) return;
    const { x, y } = getImageCoords(e);
    setDrawing({ startX: x, startY: y, curX: x, curY: y });
  };

  const handleMouseMove = (e) => {
    if (!naturalSize) return;
    if (panRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const dx = e.clientX - panRef.current.clientX;
      const dy = e.clientY - panRef.current.clientY;
      panRef.current = { clientX: e.clientX, clientY: e.clientY };
      setView((v) =>
        clampView(
          {
            ...v,
            x: v.x - (dx / rect.width) * (naturalSize.width / v.zoom),
            y: v.y - (dy / rect.height) * (naturalSize.height / v.zoom),
          },
          naturalSize
        )
      );
      return;
    }
    const p = getImageCoords(e);
    if (drawing) {
      setDrawing((d) => (d ? { ...d, curX: p.x, curY: p.y } : d));
    } else {
      setHoverIndex(regionAt(p));
    }
  };

  const handleMouseUp = (e) => {
    if (e.button === 2 || e.type === "mouseleave") panRef.current = null;
    if (e.button === 2) return;
    if (!drawing || !naturalSize) {
      setDrawing(null);
      return;
    }
    const w = Math.abs(drawing.curX - drawing.startX);
    const h = Math.abs(drawing.curY - drawing.startY);
    setDrawing(null);
    // Under 6 on-screen pixels is an accidental click, not a deliberate
    // drag, so no region is created.
    const minSize = (6 * naturalSize.width) / PREVIEW_WIDTH / view.zoom;
    if (w < minSize || h < minSize) return;

    setManualBoxes((mb) => [
      ...mb,
      {
        x: Math.min(drawing.startX, drawing.curX),
        y: Math.min(drawing.startY, drawing.curY),
        width: w,
        height: h,
      },
    ]);
  };

  // Applies the blur at full resolution (not the small preview canvas),
  // for every manually drawn region, then hands the finished image back
  // as a Blob ready to upload — this is the only place pixel data
  // actually changes; nothing is modified until the admin explicitly
  // confirms.
  const handleConfirm = () => {
    if (!naturalSize) return;
    setApplying(true);
    try {
      const fullCanvas = document.createElement("canvas");
      fullCanvas.width = naturalSize.width;
      fullCanvas.height = naturalSize.height;
      const ctx = fullCanvas.getContext("2d");
      ctx.drawImage(imgRef.current, 0, 0, naturalSize.width, naturalSize.height);

      manualBoxes.forEach((b) => pixelateRegion(ctx, b.x, b.y, b.width, b.height));

      fullCanvas.toBlob(
        (blob) => {
          setApplying(false);
          onConfirm(blob);
        },
        "image/jpeg",
        0.92
      );
    } catch (err) {
      setApplying(false);
      setError(err.message || "Couldn't apply blur.");
    }
  };

  const totalBlurCount = manualBoxes.length;

  return (
    <div className="modal-overlay">
      <div className="modal face-review-modal" onClick={(e) => e.stopPropagation()}>
        <div className="preview-header">
          <h3>Mark any sensitive areas before publishing</h3>
          <button className="close-btn" onClick={onCancel}>✕</button>
        </div>

        {/* Hidden full-resolution source image — used for both the small
            preview draw and the final full-res blur pass. */}
        <img ref={imgRef} src={imageUrl} onLoad={handleImgLoad} style={{ display: "none" }} alt="" />

        {error && <p className="directions-error">{error}</p>}

        <canvas
          ref={canvasRef}
          width={PREVIEW_WIDTH}
          // Follows the photo's own shape (not a fixed 16:9), so a portrait
          // or square room photo isn't drawn stretched in the preview.
          height={naturalSize ? Math.max(1, Math.round((PREVIEW_WIDTH * naturalSize.height) / naturalSize.width)) : 495}
          className="face-review-canvas"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={(e) => {
            setHoverIndex(null);
            handleMouseUp(e);
          }}
          onContextMenu={(e) => e.preventDefault()}
        />
        <div className="face-review-zoom">
          <button type="button" onClick={() => zoomBy(1 / ZOOM_STEP)} disabled={view.zoom <= 1} title="Zoom out">-</button>
          <span className="face-review-zoom-level">{Math.round(view.zoom * 100)}%</span>
          <button type="button" onClick={() => zoomBy(ZOOM_STEP)} disabled={view.zoom >= MAX_ZOOM} title="Zoom in">+</button>
          <button type="button" onClick={resetZoom} disabled={view.zoom === 1}>Reset</button>
        </div>
        <p className="field-hint">
          Click and drag on the photo to mark a face or sensitive area to blur. Zoom with the buttons, then hold the right mouse button and drag to move around the photo.
        </p>

        {manualBoxes.length === 0 && (
          <p className="field-hint">No regions marked yet. Safe to publish as-is, or drag to mark one.</p>
        )}

        {manualBoxes.length > 0 && (
          <div className="face-review-footer-row">
            <div className="face-review-manual-chips">
              {manualBoxes.map((_, i) => (
                <span
                  key={i}
                  className="face-review-manual-chip"
                  onMouseEnter={() => setHoverIndex(i)}
                  onMouseLeave={() => setHoverIndex(null)}
                >
                  Region {i + 1}
                  <button type="button" onClick={() => removeManualBox(i)} title="Remove">×</button>
                </span>
              ))}
            </div>
            <p className="field-hint face-review-count">{totalBlurCount} region{totalBlurCount === 1 ? "" : "s"} will be blurred.</p>
          </div>
        )}

        <div className="form-actions">
          <button className="primary" onClick={handleConfirm} disabled={applying}>
            {applying ? "Applying…" : totalBlurCount > 0 ? "Blur & Publish" : "Publish"}
          </button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
