import { useCallback, useEffect, useMemo, useRef } from "react";
import { apiPost, apiUrl } from "../utils/apiClient";
import { getKioskToken } from "../utils/kioskToken";

const FLUSH_INTERVAL_MS = 15000;
const MAX_QUEUED = 10;
const WEB_SESSION_KEY = "ariseAnalyticsSession";

// crypto.randomUUID() only exists in secure contexts (HTTPS, or the
// localhost exception) — dev/kiosk testing over plain http://<LAN-ip>
// (e.g. WiFi) is not secure, so it's undefined there and throws,
// crashing the whole app before first render. These ids just need to be
// unique per session, not cryptographically random, so fall back to a
// manual UUID v4 when the API is missing.
function newSessionId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Compact layout (the kiosk view): a fresh id every mount — MainPageContent
// only remounts on a real session boundary (feedback given, or the idle
// countdown's "start over"). Otherwise no such remount exists, so the id is read from sessionStorage
// (survives a refresh, starts fresh in a new tab) and the session is closed
// server-side by inactivity timeout instead of an explicit end event.
function sessionIdFor(compact) {
  if (compact) return newSessionId();
  try {
    const existing = sessionStorage.getItem(WEB_SESSION_KEY);
    if (existing) return existing;
  } catch {
    return newSessionId();
  }
  return rotatedWebSessionId();
}

function rotatedWebSessionId() {
  const id = newSessionId();
  try {
    sessionStorage.setItem(WEB_SESSION_KEY, id);
  } catch {
    // Storage blocked: the id still works for this page's lifetime.
  }
  return id;
}

// Tracks kiosk/web analytics events (see Analytics_API/track) and
// batches them instead of firing one request per action — a single kiosk
// session can generate dozens of "move" events. Flushes on an interval, on
// tab hide, and on unmount. Every call here is best-effort: a failed or
// dropped flush must never surface to the visitor, so failures are
// swallowed.
//
// `compact`: the visitor view is the Compact layout (session behavior: fresh
// id per mount, explicit end events). `paired`: this device is a paired
// kiosk; only then does the server count its sessions as "kiosk", every
// other session, kiosk layout or not, is a "web" session. The server decides
// that from the kiosk token sent along, never from a client claim. `ready`
// holds flushing back until pairing is known, so a session can't be
// recorded as web a moment before the kiosk is recognised.
//
// Returns { setLocation, stageReached, roomSearched, goTo,
//   directionsRequested, move, feedbackSubmitted, sessionEnd }.
export function useAnalytics({ compact, paired, ready = true }) {
  // A ref, not a memo: the web layout swaps to a fresh id after feedback
  // (see feedbackSubmitted) without remounting anything.
  const layoutSessionId = useMemo(() => sessionIdFor(compact), [compact]);
  const sessionIdRef = useRef(layoutSessionId);
  useEffect(() => {
    sessionIdRef.current = layoutSessionId;
  }, [layoutSessionId]);
  const identityRef = useRef({ paired, ready });
  useEffect(() => {
    identityRef.current = { paired, ready };
  }, [paired, ready]);
  const queueRef = useRef([]);
  const metaRef = useRef({ campus: null, building: null });

  const flush = useCallback(() => {
    if (!queueRef.current.length) return;
    // Events wait in the queue until pairing is known.
    if (!identityRef.current.ready) return;
    const events = queueRef.current;
    queueRef.current = [];
    const body = {
      session_id: sessionIdRef.current,
      kiosk_token: identityRef.current.paired ? getKioskToken() || undefined : undefined,
      has_gate: compact,
      ...metaRef.current,
      events,
    };

    // On a page-hide path a normal fetch can be cancelled mid-flight by the
    // tab closing; sendBeacon survives that. text/plain keeps it a
    // CORS-simple request (sendBeacon can't wait out a preflight) — the
    // backend's getInput() parses the JSON body regardless of Content-Type.
    if (document.visibilityState === "hidden" && navigator.sendBeacon) {
      navigator.sendBeacon(apiUrl("Analytics_API/track"), new Blob([JSON.stringify(body)], { type: "text/plain" }));
      return;
    }
    apiPost("Analytics_API/track", body).catch(() => {});
  }, [compact]);

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
      // Compact layout: the session stays open ("Keep exploring" is allowed)
      // and is ended by sessionEnd on reset. The web layout never resets, so
      // its session is ended right here and whatever the visitor does next
      // starts a fresh one instead of piling onto a session that already
      // gave feedback.
      feedbackSubmitted: (feedbackId, rating) => {
        track({ type: "feedback_submitted", feedback_id: feedbackId, rating });
        if (!compact) {
          track({ type: "session_end", reason: "feedback" });
          flush();
          sessionIdRef.current = rotatedWebSessionId();
        }
      },
      // Flushed immediately (not left for the interval) since the kiosk is
      // about to remount and drop this hook entirely.
      sessionEnd: (reason) => {
        track({ type: "session_end", reason });
        flush();
      },
    }),
    [track, flush, compact]
  );
}
