import { useEffect, useRef } from "react";

// Scrolls the ref'd element into view whenever `active` flips to true — for
// a form/section that expands in place (an "Add Marker" box, an elevator's
// floor picker) inside one of the admin CMS's scrollable content boxes.
// Without this, content revealed below the fold (e.g. by picking "+ New
// elevator...") can go unnoticed since nothing pulls the scroll position
// toward it.
export function useAutoScrollIntoView(active) {
  const ref = useRef(null);
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [active]);
  return ref;
}
