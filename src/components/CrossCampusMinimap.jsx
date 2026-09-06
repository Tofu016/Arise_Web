import { Map, Marker } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { osmRasterStyle } from "../utils/osmMapStyle";

// Small, persistent "you are here" widget — only rendered by the parent
// when the current node is an eligible entrance with real coordinates
// set. Deliberately non-interactive (no drag/zoom/scroll) — this is just
// the passive "where am I" display; expanding into a full cross-campus
// route panel with OSRM directions is a separate, later step, not
// something this piece handles yet.
export default function CrossCampusMinimap({ lat, lng, label, className = "" }) {
  return (
    <div className={`minimap-widget ${className}`.trim()}>
      <Map
        // initialViewState is only read once, at mount — keying on the
        // coordinates forces a genuine remount whenever they actually
        // change, same reasoning as the old react-leaflet version's key.
        key={`${lat}-${lng}`}
        initialViewState={{ longitude: lng, latitude: lat, zoom: 15 }}
        mapStyle={osmRasterStyle}
        style={{ width: "100%", height: "100%" }}
        dragPan={false}
        scrollZoom={false}
        doubleClickZoom={false}
        dragRotate={false}
        touchZoomRotate={false}
        touchPitch={false}
        keyboard={false}
        attributionControl={false}
      >
        <Marker longitude={lng} latitude={lat} />
      </Map>
      <div className="minimap-widget-label">{label}</div>
    </div>
  );
}
