// The hidden gestures that open the pairing screen. Each is a sequence of
// steps, a target tapped a number of times:
//
//   KIOSK_GESTURE   (Compact layout, a paired kiosk: check or unpair it)
//                   5 taps on the header logo, 5 on the node name, 5 on the
//                   advertisement band.
//   MOBILE_GESTURE  (Mobile web layout, where an unpaired kiosk device starts)
//                   5 taps on the sidebar logo, then close the sidebar and
//                   tap the node name 5 times, then open the sidebar and tap
//                   its question mark button once. The node name is behind
//                   the sidebar's dimmed backdrop while the sidebar is open
//                   (a tap there closes it instead), and the question mark
//                   lives inside the sidebar, so the sequence can only be
//                   done by closing and reopening it in between.
//
// Each run of taps must land within TAP_WINDOW_MS, and each next run start
// within STEP_GAP_MS of the last. Extra taps on the step just finished are
// ignored; a tap on any other fed target starts over. Opening and closing
// the sidebar are not fed in, so they never break the sequence.
// Meant to be something a visitor will not do by accident, not a security
// boundary: the pairing code is what protects the kiosk record.
//
// Pure, so it is tested without a screen: feed it every tap and it returns
// the next state plus whether the gesture just completed.
export const KIOSK_GESTURE = [
  { target: "logo", taps: 5 },
  { target: "title", taps: 5 },
  { target: "signage", taps: 5 },
];
export const MOBILE_GESTURE = [
  { target: "logo", taps: 5 },
  { target: "title", taps: 5 },
  { target: "help", taps: 1 },
];
export const TAP_WINDOW_MS = 3000;
export const STEP_GAP_MS = 10000;

export const initialGesture = { step: 0, count: 0, runStartedAt: 0, lastDoneAt: 0 };

export function advanceGesture(state, target, now, steps = KIOSK_GESTURE) {
  let s = state;
  // Waited too long between steps: start over before judging this tap.
  if (s.step > 0 && s.count === 0 && now - s.lastDoneAt > STEP_GAP_MS) s = initialGesture;

  // Extra taps on the step just finished (nobody counts to exactly 5) are
  // ignored rather than treated as a mistake.
  if (s.step > 0 && target === steps[s.step - 1].target) return { state: s, complete: false };

  if (target !== steps[s.step].target) {
    // A wrong target restarts, but may itself be the first tap of a new run.
    return target === steps[0].target
      ? advanceGesture(initialGesture, target, now, steps)
      : { state: initialGesture, complete: false };
  }

  const freshRun = s.count === 0 || now - s.runStartedAt > TAP_WINDOW_MS;
  const count = freshRun ? 1 : s.count + 1;
  const runStartedAt = freshRun ? now : s.runStartedAt;
  if (count < steps[s.step].taps) return { state: { ...s, count, runStartedAt }, complete: false };

  if (s.step === steps.length - 1) return { state: initialGesture, complete: true };
  return { state: { step: s.step + 1, count: 0, runStartedAt: 0, lastDoneAt: now }, complete: false };
}
