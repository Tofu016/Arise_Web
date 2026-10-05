import { useLayoutEffect, useMemo, useRef } from "react";
import * as route from "../utils/directionsRoute";
import { buildHotspots } from "../utils/hotspots";
import { floorLabel } from "../utils/constants";

// One entry per distinct thing the walking panel can say along a route: the
// next stop's name, an elevator ride, a straight run to skip. The turn word is
// the longest one, since the real one depends on which way the visitor faces.
function walkStages(path, byId, nodes) {
  const stages = new Map();
  for (let i = 0; i < path.length - 1; i++) {
    const node = byId[path[i]];
    const hotspots = node ? buildHotspots(node, byId, { withPhoto: true }) : [];
    const d = { path, stepIndex: i };
    const p = route.routeProgress(d, { byId, hotspots, entryYaw: null, nodes });
    const stage = {
      stepIndex: i,
      total: path.length,
      nextElevator: p.nextElevator,
      nextStopName: p.nextStopName,
      turnInstruction: i > 0 && p.nextStopHotspot ? "Turn around toward" : null,
      skip: route.straightRunAhead(d, byId),
      action: p.nextElevator ? `Ride elevator to ${floorLabel(p.nextElevator.floor)}` : `Walk to ${p.nextStopName}`,
    };
    const key = [stage.nextElevator?.floor, stage.nextStopName, !!stage.turnInstruction, stage.skip?.count, i > 9, i > 99].join("|");
    const kept = stages.get(key);
    if (!kept || i > kept.stepIndex) stages.set(key, stage);
  }
  return [...stages.values()];
}

// Renders, invisibly and at the sidebar's real width, the whole Directions
// form once per distinct walking stage, and reports the tallest one. The
// sidebar reserves that height as soon as the route exists, so the map under
// the form is resized once for the route's peak instead of every step.
// `renderProgress(stage)` is the same function the live panel uses, so the
// probe cannot drift from what is actually shown.
export default function DirectionsPeakProbe({ path, byId, nodes, renderProgress, onPeak }) {
  const ref = useRef(null);
  const stages = useMemo(() => walkStages(path, byId, nodes), [path, byId, nodes]);

  useLayoutEffect(() => {
    const measure = () => {
      const heights = [...(ref.current?.children ?? [])].map((el) => el.offsetHeight);
      if (heights.length) onPeak(path, Math.max(...heights));
    };
    measure();
    // Wrapping depends on the real font, which may land after first layout.
    let live = true;
    document.fonts?.ready.then(() => live && measure());
    return () => {
      live = false;
    };
  }, [stages, path, onPeak]);

  return (
    <div className="directions-probe" ref={ref} aria-hidden="true" inert>
      {stages.map((stage) => (
        <div className="directions-panel" key={stage.stepIndex}>
          <div className="directions-panel-header"><h3>Directions</h3></div>
          <label className="sidebar-field-label">
            <span className="directions-from-label">From<span className="you-are-here-pill">You are here</span></span>
            <textarea className="directions-field" rows={1} readOnly tabIndex={-1} />
          </label>
          <label className="sidebar-field-label">
            To
            <textarea className="directions-field" rows={1} readOnly tabIndex={-1} />
          </label>
          <div className="directions-suggestions-anchor" />
          {renderProgress(stage)}
        </div>
      ))}
    </div>
  );
}
