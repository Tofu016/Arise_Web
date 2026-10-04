// The hidden gesture that opens a kiosk's pairing screen: 5 taps on the
// header logo, then 5 on the node name, then 5 on the advertisement band,
// each run within TAP_WINDOW_MS, and each next run started within
// STEP_GAP_MS of the last. Extra taps on the step just finished are ignored;
// a tap anywhere else in the sequence starts over.
// Meant to be something a visitor will not do by accident, not a security
// boundary: the pairing code is what protects the kiosk record.
//
// Pure, so it is tested without a screen: feed it every tap and it returns
// the next state plus whether the gesture just completed.
export const GESTURE_STEPS = ["logo", "title", "signage"];
export const TAPS_PER_STEP = 5;
export const TAP_WINDOW_MS = 3000;
export const STEP_GAP_MS = 10000;

export const initialGesture = { step: 0, count: 0, runStartedAt: 0, lastDoneAt: 0 };

export function advanceGesture(state, target, now) {
  let s = state;
  // Waited too long between steps: start over before judging this tap.
  if (s.step > 0 && s.count === 0 && now - s.lastDoneAt > STEP_GAP_MS) s = initialGesture;

  // Extra taps on the step just finished (nobody counts to exactly 5) are
  // ignored rather than treated as a mistake.
  if (s.step > 0 && target === GESTURE_STEPS[s.step - 1]) return { state: s, complete: false };

  if (target !== GESTURE_STEPS[s.step]) {
    // A wrong target restarts, but may itself be the first tap of a new run.
    return target === GESTURE_STEPS[0] ? advanceGesture(initialGesture, target, now) : { state: initialGesture, complete: false };
  }

  const freshRun = s.count === 0 || now - s.runStartedAt > TAP_WINDOW_MS;
  const count = freshRun ? 1 : s.count + 1;
  const runStartedAt = freshRun ? now : s.runStartedAt;
  if (count < TAPS_PER_STEP) return { state: { ...s, count, runStartedAt }, complete: false };

  if (s.step === GESTURE_STEPS.length - 1) return { state: initialGesture, complete: true };
  return { state: { step: s.step + 1, count: 0, runStartedAt: 0, lastDoneAt: now }, complete: false };
}
