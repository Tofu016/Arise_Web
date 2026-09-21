import { useEffect, useRef, useState } from "react";

// Whole seconds left of a countdown that starts on mount; calls onDone once
// it reaches zero. Measured against the clock rather than counting timer
// ticks, so a long countdown (minutes) doesn't drift.
export function useCountdown(totalSeconds, onDone) {
  const endAt = useRef(Date.now() + totalSeconds * 1000);
  const [remaining, setRemaining] = useState(totalSeconds);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const id = setInterval(() => {
      const left = Math.ceil((endAt.current - Date.now()) / 1000);
      if (left <= 0) {
        clearInterval(id);
        setRemaining(0);
        onDoneRef.current();
      } else {
        setRemaining(left);
      }
    }, 250);
    return () => clearInterval(id);
  }, []);

  return remaining;
}
