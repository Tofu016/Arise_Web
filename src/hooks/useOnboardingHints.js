import { useCallback, useState } from "react";
import { activeHint, activeHints, markSeen } from "../utils/onboardingHints";

// First-time-user hints: a short ordered queue of one-time coachmarks (see
// components/Coachmark.jsx). Deliberately NOT persisted anywhere — plain
// component state, so every fresh page load (a real visitor's first
// impression, or just a refresh) starts the queue over from the top. That
// also means a kiosk's own reset-to-start-screen flow (MainPageContent
// remounting under a new key) shows them again too, which is the point:
// every new person at the kiosk gets the same walkthrough. `order` is the
// sequence of hint ids relevant to the current layout (desktop vs kiosk).
// activeId is the first not-yet-dismissed one (the kiosk's sequential
// view); activeIds is every not-yet-dismissed one (the desktop's
// show-them-all view) — see MainPage.jsx for which each layout uses.
// Dismissing one automatically drops it from both. `replay` clears every
// hint without needing a reload (wired to the help modal's "Replay the
// intro tips" button).
export function useOnboardingHints(order) {
  const [seenIds, setSeenIds] = useState([]);

  const dismiss = useCallback((id) => {
    setSeenIds((prev) => markSeen(prev, id));
  }, []);

  const replay = useCallback(() => {
    setSeenIds([]);
  }, []);

  return { activeId: activeHint(order, seenIds), activeIds: activeHints(order, seenIds), dismiss, replay };
}
