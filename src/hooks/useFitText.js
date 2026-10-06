import { useLayoutEffect, useRef, useState } from "react";

// Shrinks a single line of text (white-space: nowrap; overflow: hidden;
// text-overflow: ellipsis) one step at a time from `max` toward `min` px until
// it fits its box, so a long name loses size before it loses letters; only
// past `min` does the ellipsis cut the end off. Re-fitted when the text
// changes, on resize and rotate, and once the web fonts finish loading (a
// fallback font measures differently). Returns [ref, fontSizePx].
export function useFitText(text, { max, min, step = 0.5 }) {
  const ref = useRef(null);
  const [size, setSize] = useState(max);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const fit = () => {
      let next = max;
      el.style.fontSize = `${next}px`;
      while (next > min && el.scrollWidth > el.clientWidth) {
        next = Math.max(min, next - step);
        el.style.fontSize = `${next}px`;
      }
      setSize(next);
    };
    fit();
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) fit();
    });
    window.addEventListener("resize", fit);
    window.addEventListener("orientationchange", fit);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", fit);
      window.removeEventListener("orientationchange", fit);
    };
  }, [text, max, min, step]);

  return [ref, size];
}
