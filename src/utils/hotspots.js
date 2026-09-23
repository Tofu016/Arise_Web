import { defaultHotspotAngle } from "./constants";

// The angle a node's hotspot to one neighbor sits at: its saved angle, or
// the same evenly-spread default buildHotspots falls back to when none was
// placed yet. Shared so callers other than the hotspot renderer (e.g. Back
// navigation, facing the hotspot that leads to where you came from) agree
// with what's actually drawn.
export function hotspotAngle(node, neighborId) {
  const neighborIds = node?.neighbors || [];
  const idx = neighborIds.indexOf(neighborId);
  if (idx === -1) return null;
  return node.hotspots?.[neighborId] || defaultHotspotAngle(idx, neighborIds.length);
}

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
