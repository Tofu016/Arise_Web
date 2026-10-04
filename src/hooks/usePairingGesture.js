import { useCallback, useEffect, useRef } from "react";
import { advanceGesture, initialGesture } from "../utils/kioskPairingGesture";

// Feeds taps on the three hidden targets ("logo", "title", "signage") into
// the pairing gesture (utils/kioskPairingGesture.js) and calls onComplete
// when the last step lands. Returns tap(target).
export function usePairingGesture(onComplete) {
  const stateRef = useRef(initialGesture);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  return useCallback((target) => {
    const { state, complete } = advanceGesture(stateRef.current, target, Date.now());
    stateRef.current = state;
    if (complete) onCompleteRef.current();
  }, []);
}
