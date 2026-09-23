import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "../context/ToastContext";

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
//   mutate(fn, toast?) run fn, then refresh, then report the result —
//              `toast` is an optional { success, errorPrefix } pair; every
//              admin hook built on this passes one so every create/update/
//              delete/link surfaces a toast, success or failure, without
//              each page having to wire its own try/catch. Callers that
//              still want to catch the rejection themselves (e.g. to keep
//              a field focused on error) can — mutate rethrows either way.
//   itemsRef   always the latest loaded list, for diffs that must read
//              "what is there now" right after a refresh
export function useCollection(load, initial = []) {
  const [items, setItems] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const itemsRef = useRef(initial);
  const toast = useToast();

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
    async (fn, toastMessages) => {
      try {
        await fn();
        await refresh();
        if (toastMessages?.success) toast.success(toastMessages.success);
      } catch (err) {
        if (toastMessages?.errorPrefix) {
          toast.error(`${toastMessages.errorPrefix}: ${err.message}`);
        } else if (toastMessages) {
          // A toast config was passed but no prefix — still worth surfacing
          // the raw backend error rather than staying silent.
          toast.error(err.message);
        }
        throw err;
      }
    },
    [refresh, toast]
  );

  return { items, loading, error, refresh, mutate, itemsRef };
}
