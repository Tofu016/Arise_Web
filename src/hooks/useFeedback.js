import { useEffect, useState, useCallback } from "react";
import { apiGet, apiPatch } from "../utils/apiClient";

// Mirrors useUsers.js's own pattern — a dedicated hook for one admin
// page's data, called directly here rather than shared through
// AdminLayout's Outlet context, since (like user data) no other admin
// section needs feedback data.
export function useFeedback() {
  const [feedback, setFeedback] = useState([]);

  const refresh = useCallback(async () => {
    const data = await apiGet("Feedback_API/getAll");
    setFeedback(data.feedback);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const markReviewed = useCallback(
    async (id) => {
      await apiPatch(`Feedback_API/markReviewed/${id}`, {});
      await refresh();
    },
    [refresh]
  );

  return { feedback, markReviewed };
}
