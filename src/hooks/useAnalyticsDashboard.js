import { useEffect, useRef, useState } from "react";
import { apiGet } from "../utils/apiClient";

// One fetch-on-filter-change per Analytics_API read endpoint (see
// Analytics_API.php): summary, funnel, rooms, searches, routes, movement,
// trends, heatmap. Each keeps its own loading/error/data rather than one big
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
// which fetch is still current, so setState only ever happens from inside
// the .then/.catch callbacks. The state remembers which query its data
// answers: `loading` is the very first load (nothing to show yet), and
// `updating` is a newer filter range still in flight while the previous
// range's numbers stay on screen.
function useAnalyticsQuery(path, filters, extra) {
  const query = `Analytics_API/${path}${toQueryString(filters, extra)}`;
  const [state, setState] = useState({ query: null, data: null, error: "" });
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    apiGet(query)
      .then((data) => {
        if (requestIdRef.current === requestId) setState({ query, data, error: "" });
      })
      .catch((err) => {
        if (requestIdRef.current === requestId) {
          setState({ query, data: null, error: err.message || "Couldn't load this section." });
        }
      });
  }, [query]);

  return {
    data: state.data,
    error: state.error,
    loading: state.query === null,
    updating: state.query !== null && state.query !== query,
  };
}

export function useAnalyticsDashboard(filters) {
  return {
    summary: useAnalyticsQuery("summary", filters),
    funnel: useAnalyticsQuery("funnel", filters),
    rooms: useAnalyticsQuery("rooms", filters, { limit: 10 }),
    searches: useAnalyticsQuery("searches", filters, { limit: 10 }),
    routes: useAnalyticsQuery("routes", filters, { limit: 10 }),
    movement: useAnalyticsQuery("movement", filters),
    trends: useAnalyticsQuery("trends", filters),
    heatmap: useAnalyticsQuery("heatmap", filters),
  };
}
