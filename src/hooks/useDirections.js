import { useEffect, useRef, useState } from "react";
import { settleAutoWalk, syncToPosition } from "../utils/directionsRoute";

const AUTO_WALK_STEP_MS = 5000;

// React adapters over utils/directionsRoute.js.
//
// useDirections holds the directions state (null when closed) and keeps
// the route following wherever the visitor actually is. Returns
// [directions, setDirections]; apply directionsRoute transitions with
// setDirections((d) => transition(d, ...)).
export function useDirections(nodes, currentId) {
  const [directions, setDirections] = useState(null);

  useEffect(() => {
    setDirections((d) => syncToPosition(d, currentId, nodes));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]);

  return [directions, setDirections];
}

// useAutoWalk steps through the route on a timer while `autoWalking` is on,
// calling `step` for each hop. `step` is kept in a ref so a re-render never
// restarts the wait.
//
// directions?.path is in the dependency list even though only its identity
// matters: a freshly computed route restarts the countdown clean rather
// than inheriting what was left of the previous one. Each step changes
// stepIndex, which re-runs this with a fresh timer.
export function useAutoWalk(directions, setDirections, step) {
  const stepRef = useRef(step);
  useEffect(() => {
    stepRef.current = step;
  });

  useEffect(() => {
    if (!directions?.autoWalking) return;
    const settled = settleAutoWalk(directions);
    if (settled !== directions) {
      setDirections(settled);
      return;
    }
    const timer = setTimeout(() => stepRef.current(), AUTO_WALK_STEP_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directions?.autoWalking, directions?.stepIndex, directions?.path]);
}
