import { useEffect, useMemo } from "react";
import { Map, Marker, useMap } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { osmRasterStyle } from "../utils/osmMapStyle";
import IconPlaceholder from "./IconPlaceholder";
import { allBuildings, allCampuses, campusForBuilding } from "../utils/constants";
import { campusPins } from "../utils/campusPins";

// The campus's own name ("Main Campus", "Digital Campus"), as allCampuses()
// reports it, not the per-building name the corner tile shows.
const campusLabel = (campusId) => allCampuses().find((c) => c.id === campusId)?.label ?? campusId;

// The default maplibre pin is ~41px tall and anchored at its tip; lifting the
// label by that much parks it just above the pin's head instead of on it.
const PIN_LABEL_OFFSET = [0, -42];

// Room above for the pill that sits over each pin, a thin margin elsewhere.
// The side margin is about half a pill's width so a pill over an edge pin is
// not clipped by the modal.
const FIT_PADDING = { top: 80, bottom: 30, left: 90, right: 90 };

// fitBounds is imperative, so it needs useMap() (same reason as FlyoverPanel's
// FitToRoute). maxZoom keeps a lone pin from zooming to street level.
function FitToPins({ pins }) {
  const { current: map } = useMap();
  useEffect(() => {
    if (!map || pins.length === 0) return;
    const lngs = pins.map((p) => p.lng);
    const lats = pins.map((p) => p.lat);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: FIT_PADDING, maxZoom: 15, duration: 0 }
    );
  }, [map, pins]);
  return null;
}

// A square map of every campus, opened from the layer button at the
// bottom-left of the panorama. Its size is set in CSS and the map is fitted
// to all pins, so every campus is in view.
export default function CampusMapModal({ currentCampusId, onClose }) {
  const pins = useMemo(() => campusPins(allBuildings(), allCampuses(), campusLabel, campusForBuilding), []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const first = pins[0];

  return (
    <div className="campus-map-overlay" onClick={onClose}>
      <div
        className="campus-map-modal"
        role="dialog"
        aria-label="Campus map"
        onClick={(e) => e.stopPropagation()}
      >
        <Map
          initialViewState={{ longitude: first?.lng ?? 0, latitude: first?.lat ?? 0, zoom: 12 }}
          mapStyle={osmRasterStyle}
          style={{ width: "100%", height: "100%" }}
          attributionControl={false}
        >
          {pins.map((p) => (
            <Marker key={p.id} longitude={p.lng} latitude={p.lat} />
          ))}
          {pins.map((p) => (
            <Marker
              key={`${p.id}-label`}
              longitude={p.lng}
              latitude={p.lat}
              anchor="bottom"
              offset={PIN_LABEL_OFFSET}
            >
              <span
                className={
                  "flyover-pin-label" +
                  (p.id === currentCampusId ? "" : " flyover-pin-label-destination")
                }
              >
                {p.label}
              </span>
            </Marker>
          ))}
          <FitToPins pins={pins} />
        </Map>
        <button type="button" className="campus-map-close" onClick={onClose} aria-label="Close map" title="Close">
          <IconPlaceholder name="close" className="inline-icon-img" />
        </button>
      </div>
    </div>
  );
}
