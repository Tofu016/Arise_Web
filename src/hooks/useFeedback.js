import { useCallback } from "react";
import { apiGet, apiPatch } from "../utils/apiClient";
import { useCollection } from "./useCollection";

// A dedicated hook for one admin page's data, called directly rather than
// shared through AdminLayout's Outlet context, since no other admin
// section needs feedback data. Rows are used as the backend returns them.

async function loadAll() {
  const data = await apiGet("Feedback_API/getAll");
  return data.feedback;
}

export function useFeedback() {
  const { items: feedback, loading, error, mutate } = useCollection(loadAll);

  const markReviewed = useCallback(
    (id) => mutate(() => apiPatch(`Feedback_API/markReviewed/${id}`, {})),
    [mutate]
  );

  return { feedback, loading, error, markReviewed };
}
