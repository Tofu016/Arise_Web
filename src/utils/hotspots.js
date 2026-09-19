import { defaultHotspotAngle } from "./constants";

// The clickable arrows for a node or tour stop: one per neighbor, at its
// saved angle, or spread evenly around the circle when none was placed yet.
// `withPhoto` adds the neighbor's photo, which powers the viewer's hover
// sneak-peek (the public viewers use it; the admin editors don't).
export function buildHotspots(node, byId, { withPhoto = false } = {}) {
  const neighborIds = node.neighbors || [];
  return neighborIds.map((nid, idx) => {
    const target = byId[nid];
    const angle = node.hotspots?.[nid] || defaultHotspotAngle(idx, neighborIds.length);
    return {
      id: nid,
      name: target?.name || nid,
      ...(withPhoto ? { photo: target?.photo } : {}),
      ...angle,
    };
  });
}
