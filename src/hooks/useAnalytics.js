import { useCallback, useEffect, useMemo, useRef } from "react";
import { apiPost, apiUrl } from "../utils/apiClient";

const FLUSH_INTERVAL_MS = 15000;
const MAX_QUEUED = 10;
const DESKTOP_SESSION_KEY = "ariseAnalyticsSession";

function newSessionId() {
  return crypto.randomUUID();
}

// Kiosk: a fresh id every mount — MainPageContent only remounts on a real
// session boundary (feedback given, or the idle countdown's "start over"),
// see SESSION.md's Analytics planning notes. Desktop: no such remount
// exists, so the id is read from sessionStorage (survives a refresh,
// starts fresh in a new tab) and the session is closed server-side by
// inactivity timeout instead of an explicit end event.
function sessionIdFor(platform) {
  if (platform !== "desktop") return newSessionId();
  try {
    const existing = sessionStorage.getItem(DESKTOP_SESSION_KEY);
    if (existing) return existing;
    const id = newSessionId();
    sessionStorage.setItem(DESKTOP_SESSION_KEY, id);
    return id;
  } catch {
    return newSessionId();
  }
}

// Tracks kiosk/desktop analytics events (see Analytics_API/track) and
// batches them instead of firing one request per action — a single kiosk
// session can generate dozens of "move" events. Flushes on an interval, on
// tab hide, and on unmount. Every call here is best-effort: a failed or
// dropped flush must never surface to the visitor, so failures are
// swallowed.
//
// Returns { setLocation, stageReached, roomSearched, goTo,
//   directionsRequested, move, feedbackSubmitted, sessionEnd }.
export function useAnalytics(platform) {
  const sessionId = useMemo(() => sessionIdFor(platform), [platform]);
  const queueRef = useRef([]);
  const metaRef = useRef({ campus: null, building: null });

  const flush = useCallback(() => {
    if (!queueRef.current.length) return;
    const events = queueRef.current;
    queueRef.current = [];
    const body = { session_id: sessionId, platform, ...metaRef.current, events };

    // On a page-hide path a normal fetch can be cancelled mid-flight by the
    // tab closing; sendBeacon survives that. text/plain keeps it a
    // CORS-simple request (sendBeacon can't wait out a preflight) — the
    // backend's getInput() parses the JSON body regardless of Content-Type.
    if (document.visibilityState === "hidden" && navigator.sendBeacon) {
      navigator.sendBeacon(apiUrl("Analytics_API/track"), new Blob([JSON.stringify(body)], { type: "text/plain" }));
      return;
    }
    apiPost("Analytics_API/track", body).catch(() => {});
  }, [sessionId, platform]);

  useEffect(() => {
    const interval = setInterval(flush, FLUSH_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", flush);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  const track = useCallback(
    (event) => {
      queueRef.current.push(event);
      if (queueRef.current.length >= MAX_QUEUED) flush();
    },
    [flush]
  );

  return useMemo(
    () => ({
      // Campus/building for the session row (heatmap/funnel filters).
      // Backend only fills these in once (see Analytics_Model::ensureSession),
      // so resending the same values on every flush is harmless.
      setLocation: (campus, building) => {
        metaRef.current = {
          campus: campus ?? metaRef.current.campus,
          building: building ?? metaRef.current.building,
        };
      },
      stageReached: (stage) => track({ type: "stage_reached", stage }),
      roomSearched: (query, nodeId, matched) =>
        track({ type: "room_searched", room_query: query, node_id: nodeId || undefined, matched: !!matched }),
      goTo: (nodeId) => track({ type: "go_to", node_id: nodeId }),
      directionsRequested: (fromNodeId, toNodeId) =>
        track({ type: "directions_requested", from_node_id: fromNodeId, to_node_id: toNodeId }),
      move: (kind, fromNodeId, toNodeId) =>
        track({ type: "move", move_kind: kind, from_node_id: fromNodeId || undefined, to_node_id: toNodeId }),
      feedbackSubmitted: (feedbackId, rating) =>
        track({ type: "feedback_submitted", feedback_id: feedbackId, rating }),
      // Flushed immediately (not left for the interval) since the kiosk is
      // about to remount and drop this hook entirely.
      sessionEnd: (reason) => {
        track({ type: "session_end", reason });
        flush();
      },
    }),
    [track, flush]
  );
}
