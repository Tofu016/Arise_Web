import { useEffect, useRef, useState } from "react";
import { allBuildings } from "../utils/constants";
import { arrivalView } from "../utils/arrivalView";
import {
  initialNavigation,
  landOnDefault,
  requestWalk,
  requestJump,
  requestLand,
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
    arrival: nav.arrival,
    flyover: nav.flyover,
    // `angle` is the link walked; the arrival view comes from arrivalView
    // (manual default view, else away from the arrival's return arrow, else
    // the arrow's own yaw). `via` is the nodes a skip-ahead walk passes over
    // (see requestWalk); the stop just before arrival is the last of them.
    walk: (id, angle, meta, via) =>
      perform((n, world, now) => {
        const fromId = via?.length ? via[via.length - 1] : n.currentId;
        const view = arrivalView(angle, world.byId[id], fromId);
        return requestWalk(n, world, { id, yaw: view.yaw, pitch: view.pitch, via, meta }, now);
      }),
    // Jumping lands on a fresh node, facing `view` ({ yaw, pitch }) when
    // given (a room's own marker), else the node's own starting view if it
    // has one (set for a floor/building picker drop-in).
    jump: (id, meta, view) =>
      perform((n, world, now) => {
        const node = world.byId[id];
        const yaw = view ? view.yaw : node?.startingViewYaw;
        const pitch = view ? view.pitch : node?.startingViewPitch;
        return requestJump(n, world, { id, yaw, pitch, meta }, now);
      }),
    // The kiosk's own campus/building/floor sequence's initial pick — lands
    // on the node directly, no flyover. See requestLand.
    land: (id, meta) =>
      perform((n, world, now) => {
        const node = world.byId[id];
        return requestLand(n, world, { id, yaw: node?.startingViewYaw, pitch: node?.startingViewPitch, meta }, now);
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
