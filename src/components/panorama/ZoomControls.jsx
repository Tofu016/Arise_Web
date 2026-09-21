import { BUTTON_ZOOM_FACTOR } from "./useZoom";
import { MIN_ZOOM, MAX_ZOOM } from "../../utils/panoramaMath";

// Top-right of the panorama band: level indicator (only while zoomed away
// from the default 1.0x) beside the + / - / reset buttons.
export function ZoomControls({ zoom, setZoom }) {
  return (
    <div className="pano-zoom-controls">
      {zoom.toFixed(1) !== "1.0" && (
        <span className="pano-zoom-indicator" role="status" aria-label={`Zoom ${zoom.toFixed(1)}x`}>
          {zoom.toFixed(1)}×
        </span>
      )}
      <div className="pano-zoom-buttons">
        <button
          type="button"
          className="pano-zoom-btn"
          onClick={() => setZoom(zoom * BUTTON_ZOOM_FACTOR)}
          disabled={zoom >= MAX_ZOOM}
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          className="pano-zoom-btn"
          onClick={() => setZoom(zoom / BUTTON_ZOOM_FACTOR)}
          disabled={zoom <= MIN_ZOOM}
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          className="pano-zoom-btn"
          onClick={() => setZoom(1)}
          disabled={zoom.toFixed(1) === "1.0"}
          title="Reset zoom"
          aria-label="Reset zoom"
        >
          ↺
        </button>
      </div>
    </div>
  );
}
