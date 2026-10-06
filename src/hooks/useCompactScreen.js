import { useEffect, useState } from "react";
import { COMPACT_MAX_WIDTH, isCompactScreen } from "../utils/compactLayout";

function readCompact(maxWidth) {
  if (typeof window === "undefined") return false;
  return isCompactScreen(window.innerWidth, window.innerHeight, maxWidth);
}

function isTyping() {
  const el = typeof document !== "undefined" ? document.activeElement : null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}

// Whether the screen is compact (see utils/compactLayout.js), re-evaluated on
// resize and rotate. A resize while a text field has focus is the phone's own
// keyboard opening or closing, not a new screen: a portrait tablet losing half
// its height to the keyboard would otherwise flip to the desktop layout and
// lose the field mid-typing. Rotating still re-evaluates.
export function useCompactScreen(maxWidth = COMPACT_MAX_WIDTH) {
  const [compact, setCompact] = useState(() => readCompact(maxWidth));
  useEffect(() => {
    const onResize = () => {
      if (!isTyping()) setCompact(readCompact(maxWidth));
    };
    const onRotate = () => setCompact(readCompact(maxWidth));
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onRotate);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onRotate);
    };
  }, [maxWidth]);
  return compact;
}
