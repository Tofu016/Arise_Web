import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, apiPatch } from "../utils/apiClient";
import { useToast } from "../context/ToastContext";

export const FEEDBACK_PAGE_SIZE = 20;

// A dedicated hook for the Analytics dashboard's Comments section, called
// directly rather than shared through AdminLayout's Outlet context, since
// no other admin section needs feedback data. Rows are used as the backend
// returns them. filters: { from, to, minRating, maxRating, hasComment,
// reviewed, sort }, all optional, see Feedback_Model::getAll.
//
// Paged server-side: the first page loads whenever the filters change and
// loadMore() appends the next one. Not built on useCollection, since that
// refetches the whole list after every mutation, which here would throw
// away every page past the first.
function feedbackQuery(filters, offset) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, limit: FEEDBACK_PAGE_SIZE, offset })) {
    if (value !== undefined && value !== null && value !== "") params.set(key, value);
  }
  return `Feedback_API/getAll?${params.toString()}`;
}

// Counts per star rating for the Rating distribution chart: same date/
// rating-range filters as useFeedback, minus hasComment (see
// Feedback_Model::ratingCounts), so it counts every rating whether or not
// it came with a comment. A plain fetch-on-filter-change, same shape as
// useAnalyticsQuery, since there's nothing to page or mutate here.
export function useFeedbackRatingCounts(filters = {}) {
  const filtersKey = JSON.stringify(filters);
  const [state, setState] = useState({ key: null, counts: null, error: null });
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(JSON.parse(filtersKey))) {
      if (value !== undefined && value !== null && value !== "") params.set(key, value);
    }
    apiGet(`Feedback_API/ratingCounts?${params.toString()}`)
      .then((data) => {
        if (requestIdRef.current === requestId) setState({ key: filtersKey, counts: data.counts, error: null });
      })
      .catch((err) => {
        if (requestIdRef.current === requestId) setState({ key: filtersKey, counts: null, error: err.message });
      });
  }, [filtersKey]);

  return {
    counts: state.counts,
    loading: state.key === null,
    updating: state.key !== null && state.key !== filtersKey,
    error: state.error,
  };
}

export function useFeedback(filters = {}) {
  const filtersKey = JSON.stringify(filters);
  const [state, setState] = useState({ key: null, feedback: [], total: 0, unreviewedCount: 0, error: null });
  const [loadingMore, setLoadingMore] = useState(false);
  // Same stale-response guard as useAnalyticsQuery: only the latest filter
  // change (or the loadMore issued under it) may write state.
  const requestIdRef = useRef(0);
  const toast = useToast();

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    apiGet(feedbackQuery(JSON.parse(filtersKey), 0))
      .then((data) => {
        if (requestIdRef.current !== requestId) return;
        setState({
          key: filtersKey,
          feedback: data.feedback,
          total: data.total,
          unreviewedCount: data.unreviewedCount,
          error: null,
        });
      })
      .catch((err) => {
        if (requestIdRef.current !== requestId) return;
        setState({ key: filtersKey, feedback: [], total: 0, unreviewedCount: 0, error: err.message });
      });
  }, [filtersKey]);

  const loadMore = useCallback(async () => {
    const requestId = requestIdRef.current;
    setLoadingMore(true);
    try {
      const data = await apiGet(feedbackQuery(JSON.parse(filtersKey), state.feedback.length));
      if (requestIdRef.current !== requestId) return;
      setState((s) => ({
        ...s,
        feedback: [...s.feedback, ...data.feedback],
        total: data.total,
        unreviewedCount: data.unreviewedCount,
      }));
    } catch (err) {
      toast.error(`Couldn't load more feedback: ${err.message}`);
    } finally {
      setLoadingMore(false);
    }
  }, [filtersKey, state.feedback.length, toast]);

  // Updated in place rather than refetched, so the row keeps its position
  // and the pages already loaded stay loaded. That holds under a Status
  // filter too: a row toggled out of the filter stays put (now showing its
  // new state) until the filters change, so a misclick can be undone on
  // the spot instead of the row vanishing.
  const setReviewed = useCallback(
    async (id, reviewed) => {
      const word = reviewed ? "reviewed" : "unreviewed";
      try {
        const data = await apiPatch(`Feedback_API/${reviewed ? "markReviewed" : "markUnreviewed"}/${id}`, {});
        setState((s) => {
          const before = s.feedback.find((f) => f.id === id);
          // Only a real state change moves the badge count, so a double
          // click can't drift it.
          const changed = before && !before.reviewed_at !== !data.feedback.reviewed_at;
          return {
            ...s,
            feedback: s.feedback.map((f) => (f.id === id ? data.feedback : f)),
            unreviewedCount: changed ? Math.max(0, s.unreviewedCount + (reviewed ? -1 : 1)) : s.unreviewedCount,
          };
        });
        toast.success(`Feedback marked ${word}.`);
      } catch (err) {
        toast.error(`Couldn't mark feedback ${word}: ${err.message}`);
      }
    },
    [toast]
  );

  return {
    feedback: state.feedback,
    total: state.total,
    unreviewedCount: state.unreviewedCount,
    loading: state.key === null,
    updating: state.key !== null && state.key !== filtersKey,
    loadingMore,
    hasMore: state.feedback.length < state.total,
    error: state.error,
    loadMore,
    setReviewed,
  };
}
