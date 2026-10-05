// Which way a visitor faces on arriving at a node by walking a link.
//
// The panoramas don't share a common north (only ~40% of two-way links point
// at each other's opposite angle), so the yaw of the arrow you clicked means
// nothing in the next photo. The arrival photo's own return arrow (its link
// back to where you came from) is in the right frame: facing directly away
// from it is facing the way you walked.
//
// Precedence, first match wins:
//   manual     the link's own default view (an admin's "Set default view")
//   automatic  away from the arrival node's saved return arrow, pitch level
//   arrow      the clicked arrow's own yaw (nothing better is known)
// The same chain is ported to the mobile app (src/utils/navigation.js,
// walkEntryView); keep the two in step. See docs/arrival-view.md.
//
//   hotspot      the link walked, from the node being left: { yaw, defaultYaw?, defaultPitch? }
//   arrivalNode  the node arrived at
//   fromId       the node being left (the stop just before arrival, for a skip-ahead)
// Returns { yaw, pitch, source }.
export function arrivalView(hotspot, arrivalNode, fromId) {
  if (Number.isFinite(hotspot?.defaultYaw)) {
    return { yaw: hotspot.defaultYaw, pitch: hotspot.defaultPitch ?? 0, source: "manual" };
  }
  // Only a placed arrow counts: an unplaced link is drawn at an evenly-spread
  // placeholder angle (see hotspotAngle) that says nothing about the photo.
  const back = fromId == null ? null : arrivalNode?.hotspots?.[fromId];
  if (Number.isFinite(back?.yaw)) {
    return { yaw: (back.yaw + 180) % 360, pitch: 0, source: "automatic" };
  }
  return { yaw: hotspot?.yaw ?? 0, pitch: 0, source: "arrow" };
}
