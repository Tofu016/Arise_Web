import { useEffect, useRef, useState } from "react";
import { Map, Marker, Source, Layer, useMap } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { osmRasterStyle } from "../utils/osmMapStyle";
import { KIOSK_RAISED_STYLE } from "../utils/kioskLayout";

const AUTO_PROCEED_MS = 4000;

// fitBounds is an imperative map method, not a declarative prop — this
// needs useMap() to reach the underlying map instance directly, to
// auto-frame both points once they're known. Bounds are computed as
// explicit min/max corners rather than passing [from, to] directly, since
// a bounds box needs its actual southwest/northeast corners regardless of
// which of the two points happens to be more north/east.
function FitToRoute({ fromLat, fromLng, toLat, toLng }) {
  const { current: map } = useMap();
  useEffect(() => {
    if (!map) return;
    const west = Math.min(fromLng, toLng);
    const east = Math.max(fromLng, toLng);
    const south = Math.min(fromLat, toLat);
    const north = Math.max(fromLat, toLat);
    map.fitBounds(
      [
        [west, south],
        [east, north],
      ],
      { padding: 40 }
    );
  }, [map, fromLat, fromLng, toLat, toLng]);
  return null;
}

// The GTA V "character swap" moment — shows where the destination campus
// actually is relative to here, with a real routed path (via OSRM's
// public demo server), before actually moving the tour there. Only ever
// shown for a genuine cross-campus jump (see jumpToSearchResult in
// MainPage.jsx) — auto-proceeds after a few seconds, but can be skipped
// immediately or cancelled outright, since a mandatory, un-skippable wait
// would be bad UX regardless of how apt the cinematic reference is.
export default function FlyoverPanel({ flyover, kiosk, onComplete, onCancel }) {
  const { fromLat, fromLng, fromLabel, toLat, toLng, toLabel } = flyover;
  const [routeCoords, setRouteCoords] = useState(null);
  const [routeError, setRouteError] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setRouteCoords(null);
    setRouteError(false);

    // OSRM expects, and returns, lng,lat order (GeoJSON convention) — the
    // same order a GeoJSON LineString wants, so no swap is needed before
    // handing it to <Source>/<Layer> below.
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const coords = data?.routes?.[0]?.geometry?.coordinates;
        if (coords && coords.length > 0) {
          setRouteCoords(coords);
        } else {
          throw new Error("No route geometry in response");
        }
      })
      .catch(() => {
        if (cancelled) return;
        // Straight-line fallback — still shows the genuine spatial
        // relationship even if OSRM's public demo is temporarily down or
        // can't find a road-based route between these two specific
        // points (e.g. no verified road data linking them yet).
        setRouteError(true);
        setRouteCoords([
          [fromLng, fromLat],
          [toLng, toLat],
        ]);
      });

    return () => {
      cancelled = true;
    };
  }, [fromLat, fromLng, toLat, toLng]);

  useEffect(() => {
    timerRef.current = setTimeout(onComplete, AUTO_PROCEED_MS);
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSkip = () => {
    clearTimeout(timerRef.current);
    onComplete();
  };

  const handleCancel = () => {
    clearTimeout(timerRef.current);
    onCancel();
  };

  const routeGeoJson = routeCoords && {
    type: "Feature",
    geometry: { type: "LineString", coordinates: routeCoords },
  };

  return (
    <div
      className={"flyover-overlay" + (kiosk ? " kiosk-raised-overlay" : "")}
      style={kiosk ? KIOSK_RAISED_STYLE : undefined}
    >
      <div className="flyover-panel">
        <div className="flyover-header">
          <span>{fromLabel} → {toLabel}</span>
          <button className="flyover-cancel" onClick={handleCancel} title="Stay here">
            ✕
          </button>
        </div>

        <div className="flyover-map">
          <Map
            initialViewState={{ longitude: fromLng, latitude: fromLat, zoom: 13 }}
            mapStyle={osmRasterStyle}
            style={{ width: "100%", height: "100%" }}
            attributionControl={false}
          >
            <Marker longitude={fromLng} latitude={fromLat} />
            <Marker longitude={toLng} latitude={toLat} />
            {routeGeoJson && (
              <Source type="geojson" data={routeGeoJson}>
                <Layer
                  type="line"
                  layout={{ "line-join": "round", "line-cap": "round" }}
                  paint={{ "line-color": "#4a9eff", "line-width": 4 }}
                />
              </Source>
            )}
            <FitToRoute fromLat={fromLat} fromLng={fromLng} toLat={toLat} toLng={toLng} />
          </Map>
        </div>

        {routeError && (
          <p className="flyover-note">Showing a straight-line estimate — the routing service didn't respond.</p>
        )}

        <button className="flyover-skip primary" onClick={handleSkip}>
          Skip →
        </button>
      </div>
    </div>
  );
}
