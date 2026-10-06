import restartIcon from "../../assets/icons/restart.svg";
import { stepZoom } from "./useZoom";
import { MIN_ZOOM, MAX_ZOOM } from "../../utils/panoramaMath";
import { ZoomIndicator } from "./ZoomIndicator";

// Level indicator (only while zoomed away from the default 1.0x) to the left
// of a rectangular + / - / reset stack. The kiosk sits top-right; the desktop
// sits bottom-right (`desktop`). Both carry the same restart-icon reset
// segment. The + and - glyphs are drawn in CSS
// (.pano-zoom-plus/.pano-zoom-minus) rather than as text characters; the
// restart icon is an <img>, so its color is baked into the SVG (see CSS rule
// about currentColor through <img>).
export function ZoomControls({ zoom, setZoom, desktop = false }) {
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
        <button
          type="button"
          className="pano-zoom-btn pano-zoom-reset"
          onClick={() => setZoom(1)}
          disabled={zoom.toFixed(1) === "1.0"}
          title="Reset zoom"
          aria-label="Reset zoom"
        >
          <img className="pano-zoom-reset-icon" src={restartIcon} alt="" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
