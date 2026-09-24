import { apiDelete, apiPatch, apiPost } from "./apiClient";

// Nodes (indoor) and tour stops (outdoor) are the same kind of thing to
// edit: a point in a graph, with neighbor links, a hotspot angle per link,
// and markers. The editors hand over the WHOLE new list ("replace the
// neighbors array"), while the REST backend works through individual
// add/update/remove endpoints — so each function here diffs the current
// list against the new one and returns just the calls that difference
// needs, as plain { method, path, body } data. runCalls performs them.
//
// A graph scope says which backend the calls address:
//   api           API controller name
//   ownerKey      the body key naming the owner ("node_id" / "stop_id")
//   newMarkerBody the body for a brand-new marker beyond the owner id
//                 (nodes send a marker `type`; stops send `photos`)
export const NODE_GRAPH = {
  api: "Nodes_API",
  ownerKey: "node_id",
  newMarkerBody: (m) => ({
    type: m.type,
    label: m.label,
    yaw: m.yaw,
    pitch: m.pitch,
    ...(m.type === "elevator" ? { elevator_id: m.elevatorId } : {}),
  }),
};

export const STOP_GRAPH = {
  api: "TourStops_API",
  ownerKey: "stop_id",
  newMarkerBody: (m) => ({ label: m.label, yaw: m.yaw, pitch: m.pitch, photos: m.photos || [] }),
};

const call = (method, path, body) => ({ method, path, body });

// A newly added link gets placeholder (0, 0) angles — the real angle is
// set right after via planHotspot, matching the actual flow (add the link,
// then click the panorama to place it).
export function planNeighbors(graph, id, currentIds, nextIds) {
  const added = nextIds.filter((nid) => !currentIds.includes(nid));
  const removed = currentIds.filter((nid) => !nextIds.includes(nid));
  return [
    ...added.map((nid) =>
      call("POST", `${graph.api}/addNeighbor`, {
        [graph.ownerKey]: id,
        neighbor_id: nid,
        yaw: 0,
        pitch: 0,
        reverse_yaw: 0,
        reverse_pitch: 0,
      })
    ),
    ...removed.map((nid) =>
      call("POST", `${graph.api}/removeNeighbor`, { [graph.ownerKey]: id, neighbor_id: nid })
    ),
  ];
}

export function planHotspot(graph, id, neighborId, angle) {
  return [
    call("PATCH", `${graph.api}/updateNeighborAngle`, {
      [graph.ownerKey]: id,
      neighbor_id: neighborId,
      yaw: angle.yaw,
      pitch: angle.pitch,
    }),
  ];
}

// The arrival view for one edge (id -> neighborId) only — independent of
// the arrow's own angle set by planHotspot.
export function planDefaultView(graph, id, neighborId, angle) {
  return [
    call("PATCH", `${graph.api}/updateNeighborDefaultView`, {
      [graph.ownerKey]: id,
      neighbor_id: neighborId,
      default_yaw: angle.yaw,
      default_pitch: angle.pitch,
    }),
  ];
}

// Clears a previously set arrival view back to "no override".
export function planClearDefaultView(graph, id, neighborId) {
  return [
    call("POST", `${graph.api}/clearNeighborDefaultView`, {
      [graph.ownerKey]: id,
      neighbor_id: neighborId,
    }),
  ];
}

// Three-way: an id only in the new list is an ADD (the backend generates
// its own real id — a marker's client-side id only names its photos while
// it's being picked, and is replaced by the backend's after the refresh),
// an id in both with a different yaw/pitch is a REPOSITION, and an id
// missing from the new list is a REMOVE.
//
// Known limit: only position is compared, so an edit to an existing
// marker's label (or a stop marker's photos) is never sent. An elevator
// landing's floors and label live on its `elevators` row instead (see
// useElevators), so there's nothing elevator-specific to diff here.
export function planMarkers(graph, id, currentMarkers, nextMarkers) {
  const currentIds = currentMarkers.map((m) => m.id);
  const nextIds = nextMarkers.map((m) => m.id);

  const added = nextMarkers.filter((m) => !currentIds.includes(m.id));
  const removed = currentMarkers.filter((m) => !nextIds.includes(m.id));
  const changed = nextMarkers.filter((m) => {
    const before = currentMarkers.find((cm) => cm.id === m.id);
    return before && (before.yaw !== m.yaw || before.pitch !== m.pitch);
  });

  return [
    ...added.map((m) => call("POST", `${graph.api}/addMarker`, { [graph.ownerKey]: id, ...graph.newMarkerBody(m) })),
    ...changed.map((m) => call("PATCH", `${graph.api}/updateMarker/${m.id}`, { yaw: m.yaw, pitch: m.pitch })),
    ...removed.map((m) => call("DELETE", `${graph.api}/deleteMarker/${m.id}`)),
  ];
}

// Performs planned calls one after another, in order.
export async function runCalls(calls) {
  for (const { method, path, body } of calls) {
    if (method === "POST") await apiPost(path, body);
    else if (method === "PATCH") await apiPatch(path, body);
    else await apiDelete(path);
  }
}
