import { useEffect, useMemo, useRef, useState } from "react";

// Cheap, dependency-free pixelation: averages each small block of pixels in
// the region and fills the block with that average color. Effective enough
// to obscure a face at the resolution a manually-marked region typically
// is, without needing any external image-processing library.
function pixelateRegion(ctx, x, y, w, h, blockSize = 12) {
  if (w <= 0 || h <= 0) return;
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

export default function FaceReviewPanel({ imageBlob, storagePath: _storagePath, onConfirm, onCancel }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const [naturalSize, setNaturalSize] = useState(null);
  // Manually drawn regions — always blurred, no accept/reject toggle,
  // just remove if drawn by mistake. Stored in {x,y,width,height} shape,
  // in NATURAL image pixels.
  const [manualBoxes, setManualBoxes] = useState([]);
  // The box currently being dragged out, in CANVAS (preview) pixel space —
  // null when not actively drawing.
  const [drawing, setDrawing] = useState(null);
  const [error, setError] = useState("");
  const [applying, setApplying] = useState(false);

  const imageUrl = useMemo(() => URL.createObjectURL(imageBlob), [imageBlob]);
  useEffect(() => () => URL.revokeObjectURL(imageUrl), [imageUrl]);

  // Draws the image + manual regions + the in-progress drag rectangle
  // onto the (small) preview canvas, scaling everything from the
  // original image's pixel space to whatever size the preview canvas
  // actually renders at.
  useEffect(() => {
    if (!naturalSize || !canvasRef.current || !imgRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const scaleX = canvas.width / naturalSize.width;
    const scaleY = canvas.height / naturalSize.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imgRef.current, 0, 0, canvas.width, canvas.height);

    manualBoxes.forEach((b) => {
      ctx.strokeStyle = "#4a9eff";
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x * scaleX, b.y * scaleY, b.width * scaleX, b.height * scaleY);
    });

    if (drawing) {
      ctx.strokeStyle = "#4a9eff";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      const x = Math.min(drawing.startX, drawing.curX);
      const y = Math.min(drawing.startY, drawing.curY);
      const w = Math.abs(drawing.curX - drawing.startX);
      const h = Math.abs(drawing.curY - drawing.startY);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }
  }, [naturalSize, manualBoxes, drawing]);

  const handleImgLoad = () => {
    const img = imgRef.current;
    setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
  };

  const removeManualBox = (i) => setManualBoxes((mb) => mb.filter((_, idx) => idx !== i));

  // Converts a mouse event's page position into the canvas's own internal
  // pixel coordinates — needed because the canvas's displayed CSS size
  // (width: 100%) can differ from its actual drawing-surface resolution,
  // so a raw offsetX/offsetY would be wrong whenever those two sizes don't
  // match, which is basically always on a real screen.
  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e) => {
    if (!naturalSize) return;
    const { x, y } = getCanvasCoords(e);
    setDrawing({ startX: x, startY: y, curX: x, curY: y });
  };

  const handleMouseMove = (e) => {
    if (!drawing) return;
    const { x, y } = getCanvasCoords(e);
    setDrawing((d) => (d ? { ...d, curX: x, curY: y } : d));
  };

  const handleMouseUp = () => {
    if (!drawing || !naturalSize) {
      setDrawing(null);
      return;
    }
    const canvas = canvasRef.current;
    const w = Math.abs(drawing.curX - drawing.startX);
    const h = Math.abs(drawing.curY - drawing.startY);
    setDrawing(null);
    // Too small to be a deliberate drag — treat as an accidental click, not
    // a new region.
    if (w < 6 || h < 6) return;

    const scaleX = naturalSize.width / canvas.width;
    const scaleY = naturalSize.height / canvas.height;
    setManualBoxes((mb) => [
      ...mb,
      {
        x: Math.min(drawing.startX, drawing.curX) * scaleX,
        y: Math.min(drawing.startY, drawing.curY) * scaleY,
        width: w * scaleX,
        height: h * scaleY,
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
          onMouseLeave={handleMouseUp}
        />
        <p className="field-hint">
          Click and drag directly on the photo to mark any face or sensitive area to blur.
        </p>

        {manualBoxes.length === 0 && (
          <p className="field-hint">No regions marked yet. Safe to publish as-is, or drag to mark one.</p>
        )}

        {manualBoxes.length > 0 && (
          <div className="face-review-footer-row">
            <div className="face-review-manual-chips">
              {manualBoxes.map((_, i) => (
                <span key={i} className="face-review-manual-chip">
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
