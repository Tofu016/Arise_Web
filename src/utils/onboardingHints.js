// Which first-run hints (if any) should be showing right now, given the ids
// already dismissed and the ordered list relevant to the current layout
// (desktop vs kiosk) — see hooks/useOnboardingHints.js, which wraps this
// with React state (deliberately not persisted — see that file), and
// components/Coachmark.jsx, which renders whichever id(s) come back.
//
// Every id in `order` that hasn't been dismissed yet, in order. The kiosk
// shows only the first of these at a time (a sequential queue); the
// desktop shows all of them at once — see MainPage.jsx.
export function activeHints(order, seenIds) {
  return order.filter((id) => !seenIds.includes(id));
}

// The kiosk's sequential view of the same thing: just the next one up.
export function activeHint(order, seenIds) {
  return activeHints(order, seenIds)[0] ?? null;
}

export function markSeen(seenIds, id) {
  return seenIds.includes(id) ? seenIds : [...seenIds, id];
}
