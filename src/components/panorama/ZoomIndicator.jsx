// The "1.5×" pill shown only while zoomed away from the default 1.0x —
// shared between the kiosk's button controls (ZoomControls) and the
// desktop's scroll-wheel zoom, so both read as the same feature.
export function ZoomIndicator({ zoom, className = "pano-zoom-indicator" }) {
  if (zoom.toFixed(1) === "1.0") return null;
  return (
    <span className={className} role="status" aria-label={`Zoom ${zoom.toFixed(1)}x`}>
      {zoom.toFixed(1)}×
    </span>
  );
}
