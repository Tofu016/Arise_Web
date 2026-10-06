import { useCallback, useEffect, useRef } from "react";
import { advanceGesture, initialGesture, KIOSK_GESTURE } from "../utils/kioskPairingGesture";

// Feeds taps on the hidden targets into a pairing gesture (KIOSK_GESTURE or
// MOBILE_GESTURE, see utils/kioskPairingGesture.js) and calls onComplete when
// the last step lands. Returns tap(target), which also returns whether that
// tap completed it, so a target with its own job (the help button) can skip
// that job on the completing tap.
export function usePairingGesture(onComplete, steps = KIOSK_GESTURE) {
  const stateRef = useRef(initialGesture);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  return useCallback(
    (target) => {
      const { state, complete } = advanceGesture(stateRef.current, target, Date.now(), steps);
      stateRef.current = state;
      if (complete) onCompleteRef.current();
      return complete;
    },
    [steps]
  );
}
