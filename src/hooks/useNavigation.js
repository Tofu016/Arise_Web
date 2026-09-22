import { useEffect, useRef, useState } from "react";
import { allBuildings } from "../utils/constants";
import {
  initialNavigation,
  landOnDefault,
  requestWalk,
  requestJump,
  requestBack,
  completeFlyover,
  cancelFlyover,
} from "../utils/navigation";

// React adapter over utils/navigation.js: holds the state and supplies the
// clock and campus. The latest state also lives in a ref, so two events
// fired before a re-render (the double-tap the debounce exists for) both
// see the first one's effect.
//
// walk/jump/back/completeFlyover return { outcome, action } — see
// navigation.js.
export function useNavigation(nodes, byId) {
  const [nav, setNav] = useState(initialNavigation);
  const navRef = useRef(nav);

  const commit = (next) => {
    if (next === navRef.current) return;
    navRef.current = next;
    setNav(next);
  };

  useEffect(() => {
    commit(landOnDefault(navRef.current, nodes, allBuildings()));
  }, [nodes]);

  const perform = (transition) => {
    const result = transition(navRef.current, { byId, buildings: allBuildings() }, Date.now());
    commit(result.nav);
    return result;
  };

  return {
    currentId: nav.currentId,
    history: nav.history,
    entryYaw: nav.entryYaw,
    entryPitch: nav.entryPitch,
    flyover: nav.flyover,
    // `angle` may carry a per-edge default arrival view (defaultYaw/
    // defaultPitch), which wins over the arrow's own plain yaw/pitch —
    // same preference placement.js's walk() applies in the editors.
    walk: (id, angle, meta) =>
      perform((n, world, now) =>
        requestWalk(n, world, { id, yaw: angle?.defaultYaw ?? angle?.yaw, pitch: angle?.defaultPitch, meta }, now)
      ),
    // Jumping lands on a fresh node — if it has its own starting view
    // (set for a floor/building picker drop-in), face that.
    jump: (id, meta) =>
      perform((n, world, now) => {
        const node = world.byId[id];
        return requestJump(n, world, { id, yaw: node?.startingViewYaw, pitch: node?.startingViewPitch, meta }, now);
      }),
    back: () => perform(requestBack),
    completeFlyover: () => {
      const result = completeFlyover(navRef.current);
      commit(result.nav);
      return result;
    },
    cancelFlyover: () => commit(cancelFlyover(navRef.current)),
  };
}
