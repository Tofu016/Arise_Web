// What an admin is doing while editing a point's links and markers on its
// panorama — shared by the indoor (node) and tour (stop) navigation
// editors, which are the same mechanic over different data. Pure state and
// transitions: no React, no backend calls. Where a transition needs the
// backend, it returns the change to make (an "action") and the caller
// performs it.
//
// Session: { history, placingFor, placingMarker, entryYaw, entryPitch }
//   history        ids walked through, for Back
//   placingFor     neighbor id whose arrow is being positioned, or null
//   placingMarker  { mode: "new", marker } — a marker (id, type, label, ...
//                  whatever the domain adds, minus its angle) awaiting its
//                  first placement — or { mode: "reposition", id }; or null
//   entryYaw       the yaw the admin arrived facing
//   entryPitch     the pitch the admin arrived facing
// At most one of placingFor / placingMarker is meant to be active.

import { fuzzyIncludes } from "./fuzzy";

export function newMarkerId() {
  return `m_${Date.now().toString(36)}${Math.floor(Math.random() * 1000).toString(36)}`;
}

export function initialSession() {
  return { history: [], placingFor: null, placingMarker: null, entryYaw: 0, entryPitch: 0 };
}

export const isPlacing = (s) => !!s.placingFor || !!s.placingMarker;

// Picking a point from the editor's own list: a fresh jump, not a "walk",
// so history resets.
export function selectFresh() {
  return initialSession();
}

// Walking via a hotspot click while testing the link graph. `angle`'s
// defaultYaw/defaultPitch (the edge's own arrival-view override, if an
// admin set one) win over its plain yaw/pitch (the arrow's own angle).
export function walk(s, fromId, angle) {
  return {
    history: fromId ? [...s.history, fromId] : s.history,
    placingFor: null,
    placingMarker: null,
    entryYaw: angle?.defaultYaw ?? angle?.yaw ?? 0,
    entryPitch: angle?.defaultPitch ?? 0,
  };
}

// { session, id } for the point to go back to, or null with nothing to go
// back to.
export function back(s) {
  if (s.history.length === 0) return null;
  const history = [...s.history];
  const id = history.pop();
  return { session: { history, placingFor: null, placingMarker: null, entryYaw: 0, entryPitch: 0 }, id };
}

export const startPlacingLink = (s, neighborId) => ({ ...s, placingFor: neighborId });
export const startPlacingMarker = (s, marker) => ({ ...s, placingMarker: { mode: "new", marker } });
export const startRepositionMarker = (s, id) => ({ ...s, placingMarker: { mode: "reposition", id } });
export const cancelLinkPlacement = (s) => ({ ...s, placingFor: null });
export const cancelMarkerPlacement = (s) => ({ ...s, placingMarker: null });

// The admin clicked the panorama at `angle` while placing something.
// Returns { session, action } — action is
//   { type: "hotspot", neighborId, angle }   set a link's angle
//   { type: "markers", markers }             the point's full new marker list
// — or null when nothing was being placed.
export function place(s, current, angle) {
  if (s.placingFor) {
    return { session: { ...s, placingFor: null }, action: { type: "hotspot", neighborId: s.placingFor, angle } };
  }
  if (s.placingMarker) {
    const markers = current.markers || [];
    const next =
      s.placingMarker.mode === "new"
        ? [...markers, { ...s.placingMarker.marker, ...angle }]
        : markers.map((m) => (m.id === s.placingMarker.id ? { ...m, ...angle } : m));
    return { session: { ...s, placingMarker: null }, action: { type: "markers", markers: next } };
  }
  return null;
}

// Links, as the neighbor id list a change would leave.
export const withLink = (current, id) => [...(current.neighbors || []), id];
export const withoutLink = (current, id) => (current.neighbors || []).filter((n) => n !== id);
export const withoutMarker = (current, id) => (current.markers || []).filter((m) => m.id !== id);

// Points that could be linked from `current` matching a typed query (id or
// name), leaving out itself and existing neighbors; at most 8.
export function candidateLinks(items, current, query) {
  if (!current || !query.trim()) return [];
  return items
    .filter((i) => i.id !== current.id && !(current.neighbors || []).includes(i.id))
    .filter((i) => fuzzyIncludes(query, [i.id, i.name]))
    .slice(0, 8);
}
