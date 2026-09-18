import { useState, useEffect } from "react";

// Returns [idle, resetIdle]. Once idle becomes true, this hook stops
// listening for activity entirely — a real, deliberate design choice,
// not an oversight. The prompt this feeds is only ever cleared by an
// explicit choice the caller makes (resetIdle(), called when a button
// is clicked), not by ambient mouse movement. Without this, moving the
// mouse toward either of the prompt's own buttons would immediately
// reset the timer and dismiss the prompt before it could ever actually
// be clicked — the prompt itself involves activity that would otherwise
// count against it.
//
// enabled lets the caller suppress idle detection entirely while some
// other overlay is already open (search panel, feedback panel, etc.) —
// no timer runs at all in that case, so this prompt can never appear
// stacked on top of something else already showing.
export function useIdleDetector(timeoutMs, enabled) {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setIdle(false);
      return;
    }
    if (idle) return; // paused — see this hook's own comment above

    let timer = setTimeout(() => setIdle(true), timeoutMs);
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), timeoutMs);
    };
    const events = ["mousemove", "mousedown", "touchstart", "keydown", "wheel"];
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [enabled, timeoutMs, idle]);

  const resetIdle = () => setIdle(false);
  return [idle, resetIdle];
}
