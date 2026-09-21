import { useEffect, useState } from "react";

// Touch/stylus input has no hover state, so the "sneak-peek" preview
// (built around onPointerOver/onPointerOut below) has no touch
// equivalent — matchMedia("pointer: coarse") is the standard way to
// detect that up front rather than guessing from screen size, since a
// touchscreen kiosk monitor can be any width. Re-checked on change so a
// device with both a touchscreen and a mouse attached still tracks
// whichever was used most recently.
export function useIsCoarsePointer() {
  const [coarse, setCoarse] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches
  );
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(pointer: coarse)");
    const onChange = () => setCoarse(mq.matches);
    mq.addEventListener ? mq.addEventListener("change", onChange) : mq.addListener(onChange);
    return () => {
      mq.removeEventListener ? mq.removeEventListener("change", onChange) : mq.removeListener(onChange);
    };
  }, []);
  return coarse;
}
