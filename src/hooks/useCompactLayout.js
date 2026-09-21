import { useEffect, useState } from "react";
import { COMPACT_MAX_WIDTH, isCompactLayout } from "../utils/compactLayout";

function readCompact(maxWidth) {
  if (typeof window === "undefined") return false;
  return isCompactLayout(window.innerWidth, window.innerHeight, maxWidth);
}

// Whether the Compact layout is in use, re-evaluated on resize and rotate.
export function useCompactLayout(maxWidth = COMPACT_MAX_WIDTH) {
  const [compact, setCompact] = useState(() => readCompact(maxWidth));
  useEffect(() => {
    const onResize = () => setCompact(readCompact(maxWidth));
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [maxWidth]);
  return compact;
}
