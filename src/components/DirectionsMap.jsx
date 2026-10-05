import { useEffect, useMemo, useRef } from "react";
import { Map, Marker, Source, Layer, useMap } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { osmRasterStyle } from "../utils/osmMapStyle";
import IconPlaceholder from "./IconPlaceholder";
import { allBuildings, allCampuses, campusForBuilding } from "../utils/constants";
import { campusPins } from "../utils/campusPins";
import { useRoadRoute } from "../hooks/useRoadRoute";

const campusLabel = (campusId) => allCampuses().find((c) => c.id === campusId)?.label ?? campusId;

// The default maplibre pin is ~41px tall and anchored at its tip; lifting the
// label by that much parks it just above the pin's head instead of on it.
const PIN_LABEL_OFFSET = [0, -42];

// Room above for the pill (or the two stacked pills) over each pin, a thin
// margin elsewhere; the side margin is about half a pill so an edge pin's
// pill is not clipped.
const FIT_PADDING = { top: 100, bottom: 40, left: 90, right: 90 };

// fitBounds is imperative, so it needs useMap() (same reason as
// FlyoverPanel's FitToRoute). Re-fits whenever the set of framed points
// changes; the first fit is instant so the map never opens on the wrong spot.
function FitToPoints({ points }) {
  const { current: map } = useMap();
  const fittedOnce = useRef(false);
  useEffect(() => {
    if (!map || points.length === 0) return;
    const lngs = points.map((p) => p.lng);
    const lats = points.map((p) => p.lat);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: FIT_PADDING, maxZoom: 15, duration: fittedOnce.current ? 500 : 0 }
    );
    fittedOnce.current = true;
  }, [map, points]);
  return null;
}

const HERE = "You are currently here";
const DEST = "Destination point";

// The sidebar's map for the Directions view. Same pins and pills as the
// flyover and the campus map: with only a campus's From set it shows "You are
// currently here", with To "Destination point". Both in one campus stack the
// two pills on one pin (here on top); across campuses each campus gets its own pin, a road
// route joins them, and the view fits both.
export default function DirectionsMap({ fromCampusId, toCampusId, buildingName }) {
  const mapRef = useRef(null);
  const pins = useMemo(() => campusPins(allBuildings(), allCampuses(), campusLabel, campusForBuilding), []);
  const fromPin = pins.find((p) => p.id === fromCampusId) ?? null;
  const toPin = pins.find((p) => p.id === toCampusId) ?? null;
  const crossCampus = !!fromPin && !!toPin && fromPin.id !== toPin.id;

  const { coords: routeCoords } = useRoadRoute(crossCampus ? fromPin : null, crossCampus ? toPin : null);
  const routeGeoJson = crossCampus && routeCoords
    ? { type: "Feature", geometry: { type: "LineString", coordinates: routeCoords } }
    : null;

  // The campus-map scheme when nothing is picked yet: every campus, named.
  const idle = !fromPin && !toPin;
  const markers = idle
    ? pins.map((p) => ({ pin: p, pills: [{ text: p.label, destination: false }] }))
    : crossCampus
      ? [
          { pin: fromPin, pills: [{ text: HERE, destination: false }] },
          { pin: toPin, pills: [{ text: DEST, destination: true }] },
        ]
      : fromPin && toPin
        ? [{ pin: fromPin, pills: [{ text: HERE, destination: false }, { text: DEST, destination: true }] }]
        : [{
            pin: fromPin ?? toPin,
            pills: [fromPin ? { text: HERE, destination: false } : { text: DEST, destination: true }],
          }];

  const framed = useMemo(
    () => (idle ? pins : [fromPin, toPin].filter(Boolean)),
    [idle, pins, fromPin, toPin]
  );
  const first = pins[0];

  return (
    <div className="directions-map" role="region" aria-label="Directions map">
      <Map
        ref={mapRef}
        initialViewState={{ longitude: first?.lng ?? 0, latitude: first?.lat ?? 0, zoom: 12 }}
        mapStyle={osmRasterStyle}
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
      >
        {routeGeoJson && (
          <Source type="geojson" data={routeGeoJson}>
            <Layer
              type="line"
              layout={{ "line-join": "round", "line-cap": "round" }}
              paint={{ "line-color": "#4a9eff", "line-width": 4 }}
            />
          </Source>
        )}
        {markers.map(({ pin }) => (
          <Marker key={pin.id} longitude={pin.lng} latitude={pin.lat} />
        ))}
        {markers.map(({ pin, pills }) => (
          <Marker
            key={`${pin.id}-label`}
            longitude={pin.lng}
            latitude={pin.lat}
            anchor="bottom"
            offset={PIN_LABEL_OFFSET}
          >
            <div className="directions-map-pills">
              {pills.map((pill) => (
                <span
                  key={pill.text}
                  className={"flyover-pin-label" + (pill.destination ? " flyover-pin-label-destination" : "")}
                >
                  {pill.text}
                </span>
              ))}
            </div>
          </Marker>
        ))}
        <FitToPoints points={framed} />
      </Map>

      <div className="directions-map-badge" aria-hidden="true">
        <IconPlaceholder name="map-layers" variant="white" className="directions-map-badge-icon" />
        <span className="directions-map-badge-label">{buildingName}</span>
      </div>

      <div className="directions-map-zoom">
        <button type="button" onClick={() => mapRef.current?.zoomIn()} aria-label="Zoom in" title="Zoom in">
          <IconPlaceholder name="zoom-in" variant="white" className="directions-map-zoom-icon" />
        </button>
        <button type="button" onClick={() => mapRef.current?.zoomOut()} aria-label="Zoom out" title="Zoom out">
          <IconPlaceholder name="zoom-out" variant="white" className="directions-map-zoom-icon" />
        </button>
      </div>
    </div>
  );
}
