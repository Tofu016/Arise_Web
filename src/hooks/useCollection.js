import { useCallback, useEffect, useRef, useState } from "react";

// The list/loading/refresh/mutate shape every entity hook shares: fetch
// once on mount, then refetch after every mutation (no live subscription —
// reload-to-see-updates is the accepted trade-off).
//
// `load` must be a stable function (define it at module level) returning
// the mapped items.
//
//   items      the current list (`initial` until the first load lands)
//   loading    true until the first load settles, success or failure
//   error      message of a failed load, cleared by the next good one
//   refresh    reload; rejects on failure so a mutation that refetches
//              fails with it
//   mutate(fn) run fn, then refresh
//   itemsRef   always the latest loaded list, for diffs that must read
//              "what is there now" right after a refresh
export function useCollection(load, initial = []) {
  const [items, setItems] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const itemsRef = useRef(initial);

  const refresh = useCallback(async () => {
    try {
      const next = await load();
      itemsRef.current = next;
      setItems(next);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    refresh().catch((err) => setError(err.message));
  }, [refresh]);

  const mutate = useCallback(
    async (fn) => {
      await fn();
      await refresh();
    },
    [refresh]
  );

  return { items, loading, error, refresh, mutate, itemsRef };
}
