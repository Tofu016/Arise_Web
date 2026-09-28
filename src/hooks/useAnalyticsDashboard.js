import { useEffect, useRef, useState } from "react";
import { apiGet } from "../utils/apiClient";

// One fetch-on-filter-change per Analytics_API read endpoint (see
// Analytics_API.php): summary, funnel, rooms, routes, movement, trends,
// heatmap. Each keeps its own loading/error/data rather than one big
// Promise.all, so a slow section (e.g. heatmap's two queries) doesn't hold
// back the KPI cards or funnel from showing up first.
//
// filters: { from, to, platform, building } — platform/building "" means
// "all" and is left out of the query string entirely.
function toQueryString(filters, extra = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, ...extra })) {
    if (value !== undefined && value !== null && value !== "") params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

// requestIdRef (not a `cancelled` flag set from the effect body) tracks
// which fetch is still current — setState only ever happens from inside
// the .then/.catch callbacks, never synchronously in the effect body.
// A side effect: `loading` doesn't flip back to true when the filters
// change and a fresh fetch starts, only on the very first load — a
// section shows its previous range's numbers for a moment rather than a
// loading flash, an acceptable trade for a filter dashboard like this.
function useAnalyticsQuery(path, filters, extra) {
  const [state, setState] = useState({ data: null, loading: true, error: "" });
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    apiGet(`Analytics_API/${path}${toQueryString(filters, extra)}`)
      .then((data) => {
        if (requestIdRef.current === requestId) setState({ data, loading: false, error: "" });
      })
      .catch((err) => {
        if (requestIdRef.current === requestId) {
          setState({ data: null, loading: false, error: err.message || "Couldn't load this section." });
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, filters.from, filters.to, filters.platform, filters.building, JSON.stringify(extra)]);

  return state;
}

export function useAnalyticsDashboard(filters) {
  return {
    summary: useAnalyticsQuery("summary", filters),
    funnel: useAnalyticsQuery("funnel", filters),
    rooms: useAnalyticsQuery("rooms", filters, { limit: 10 }),
    routes: useAnalyticsQuery("routes", filters, { limit: 10 }),
    movement: useAnalyticsQuery("movement", filters),
    trends: useAnalyticsQuery("trends", filters),
    heatmap: useAnalyticsQuery("heatmap", filters),
  };
}
