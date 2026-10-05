import { stepZoom } from "./useZoom";
import { MIN_ZOOM, MAX_ZOOM } from "../../utils/panoramaMath";
import { ZoomIndicator } from "./ZoomIndicator";

// Level indicator (only while zoomed away from the default 1.0x) to the left
// of a rectangular + / - stack. The kiosk (`showReset`) adds a reset segment
// and sits top-right; the desktop sits bottom-right (`desktop`) and resets by
// scrolling back, so it has none. The + and - glyphs are drawn in CSS
// (.pano-zoom-plus/.pano-zoom-minus) rather than as text characters.
export function ZoomControls({ zoom, setZoom, showReset = false, desktop = false }) {
  return (
    <div className={`pano-zoom-controls${desktop ? " pano-zoom-controls-desktop" : ""}`}>
      <ZoomIndicator zoom={zoom} />
      <div className="pano-zoom-buttons">
        <button
          type="button"
          className="pano-zoom-btn"
          onClick={() => setZoom(stepZoom(zoom, 1))}
          disabled={zoom >= MAX_ZOOM}
          aria-label="Zoom in"
        >
          <span className="pano-zoom-plus" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="pano-zoom-btn"
          onClick={() => setZoom(stepZoom(zoom, -1))}
          disabled={zoom <= MIN_ZOOM}
          aria-label="Zoom out"
        >
          <span className="pano-zoom-minus" aria-hidden="true" />
        </button>
        {showReset && (
          <button
            type="button"
            className="pano-zoom-btn pano-zoom-reset"
            onClick={() => setZoom(1)}
            disabled={zoom.toFixed(1) === "1.0"}
            title="Reset zoom"
            aria-label="Reset zoom"
          >
            1x
          </button>
        )}
      </div>
    </div>
  );
}
