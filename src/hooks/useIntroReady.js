import { useEffect, useState } from "react";

// How long an intro overlay shows before it can be dismissed. Long enough to
// absorb a stray double-tap or the click that opened it, so nobody skips the
// instructions by accident.
export const INTRO_DISMISS_DELAY_MS = 2250;

// True once an overlay has been open for INTRO_DISMISS_DELAY_MS. Resets each
// time it reopens, since the overlays stay mounted while closed.
export function useIntroReady(open) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => setReady(true), INTRO_DISMISS_DELAY_MS);
    return () => {
      clearTimeout(id);
      setReady(false);
    };
  }, [open]);

  return ready;
}
