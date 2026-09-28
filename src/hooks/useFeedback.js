import { useCallback } from "react";
import { apiGet, apiPatch } from "../utils/apiClient";
import { useCollection } from "./useCollection";

// A dedicated hook for the Analytics dashboard's Comments section, called
// directly rather than shared through AdminLayout's Outlet context, since
// no other admin section needs feedback data. Rows are used as the backend
// returns them. filters: { from, to, minRating, hasComment } — all
// optional, see Feedback_Model::getAll.
async function loadAll(filters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters || {})) {
    if (value !== undefined && value !== null && value !== "") params.set(key, value);
  }
  const qs = params.toString();
  const data = await apiGet(`Feedback_API/getAll${qs ? `?${qs}` : ""}`);
  return data.feedback;
}

export function useFeedback(filters = {}) {
  const filtersKey = JSON.stringify(filters);
  const load = useCallback(() => loadAll(filters), [filtersKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const { items: feedback, loading, error, mutate } = useCollection(load);

  const markReviewed = useCallback(
    (id) =>
      mutate(() => apiPatch(`Feedback_API/markReviewed/${id}`, {}), {
        success: "Feedback marked reviewed.",
        errorPrefix: "Couldn't mark feedback reviewed",
      }),
    [mutate]
  );

  return { feedback, loading, error, markReviewed };
}
