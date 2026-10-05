import { useEffect, useState } from "react";

// A driving route between two points from OSRM's public demo server, as the
// GeoJSON-order [lng, lat] coordinate list a map line layer takes directly.
// Falls back to a straight line (and flags `error`) when the service is down
// or has no road data linking the points. Pass null for `to` or `from` to
// skip the request (coords stay null).
export function useRoadRoute(from, to) {
  // Tagged with the request it answers, so a result for an old pair is never
  // shown for a new one while the new request is still in flight.
  const [state, setState] = useState({ key: null, coords: null, error: false });
  const fromLat = from?.lat;
  const fromLng = from?.lng;
  const toLat = to?.lat;
  const toLng = to?.lng;
  const active = fromLat != null && fromLng != null && toLat != null && toLng != null;
  const key = active ? `${fromLng},${fromLat};${toLng},${toLat}` : null;

  useEffect(() => {
    let cancelled = false;
    if (!key) return undefined;

    // OSRM takes and returns lng,lat order, the same order a GeoJSON
    // LineString wants, so no swap is needed.
    const url = `https://router.project-osrm.org/route/v1/driving/${key}?overview=full&geometries=geojson`;
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const coords = data?.routes?.[0]?.geometry?.coordinates;
        if (!coords || coords.length === 0) throw new Error("No route geometry in response");
        setState({ key, coords, error: false });
      })
      .catch(() => {
        if (cancelled) return;
        setState({
          key,
          coords: [
            [fromLng, fromLat],
            [toLng, toLat],
          ],
          error: true,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [key, fromLat, fromLng, toLat, toLng]);

  return state.key === key ? state : { key, coords: null, error: false };
}
