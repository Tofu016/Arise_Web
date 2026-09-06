import { useState, useEffect, useCallback, useRef } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "../utils/apiClient";

// Rewritten to call TourStops_API instead of Firestore. This one is
// genuinely more involved than useTourSections.js — the public
// interface (stops, selectedStopId, addStop, updateStop, renameStopId,
// deleteStop, setNeighbors, setHotspot, setMarkers) is kept completely
// unchanged so TourStopsPage.jsx, TourNavigationEditorPage.jsx,
// TourStopForm.jsx, and TourStopList.jsx need zero changes of their
// own — but several of these calls used to mean "replace the whole
// array" (Firestore's own natural shape), while the REST backend works
// through individual add/update/remove endpoints. Bridging that gap is
// what most of this file actually does.
//
// itemsRef mirrors the current stops list for the diff-based bridging
// below (setNeighbors/setMarkers need to compare old vs. new), same
// reasoning as the original useGraphCollection.js's own itemsRef.

function toFrontendStop(row) {
  const hotspots = {};
  const neighbors = (row.neighbors || []).map((n) => {
    hotspots[n.neighbor_id] = { yaw: n.yaw, pitch: n.pitch };
    return n.neighbor_id;
  });

  const markers = (row.markers || []).map((m) => ({
    id: m.id,
    type: m.type,
    label: m.label,
    yaw: m.yaw,
    pitch: m.pitch,
    // Backend photos are objects (id, photo_path, sort_order, already
    // in carousel order) — the components only ever want plain path
    // strings, matching what Firestore's array of strings always was.
    photos: (m.photos || []).map((p) => p.photo_path),
  }));

  return {
    id: row.id,
    name: row.name,
    section: row.section_id || "",
    photo: row.photo_path || "",
    description: row.description || "",
    neighbors,
    hotspots,
    markers,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function useTourStops() {
  const [stops, setStops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStopId, setSelectedStopId] = useState(null);

  const stopsRef = useRef([]);
  useEffect(() => {
    stopsRef.current = stops;
  }, [stops]);

  const refresh = useCallback(async () => {
    try {
      const data = await apiGet("TourStops_API/getAll");
      setStops(data.stops.map(toFrontendStop));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Client provides the id (TourStopForm.jsx already suggested/validated
  // one) — the backend now accepts it directly rather than generating
  // its own, matching the original contract exactly (see
  // TourStops_Model::create's own comment for why).
  const addStop = useCallback(
    async (item) => {
      await apiPost("TourStops_API/create", {
        id: item.id,
        name: item.name,
        section_id: item.section || undefined,
        photo_path: item.photo || undefined,
        description: item.description || undefined,
      });
      await refresh();
    },
    [refresh]
  );

  const updateStop = useCallback(
    async (id, patch) => {
      const body = {};
      if (patch.name !== undefined) body.name = patch.name;
      // An empty string here means "no section" (TourStopForm.jsx's own
      // "— No section —" option) — genuinely a real bug caught during
      // testing: section_id is a foreign key, so the database expects
      // either a real id or NULL, never a literal empty string. Sending
      // "" as-is caused an unhandled 500 the very first time a
      // no-section stop got edited through the real form (a plain
      // Postman test with just photo_path never exercised this path,
      // which is why it looked fine in isolation).
      if (patch.section !== undefined) body.section_id = patch.section || null;
      if (patch.photo !== undefined) body.photo_path = patch.photo;
      if (patch.description !== undefined) body.description = patch.description;

      if (Object.keys(body).length > 0) {
        await apiPatch(`TourStops_API/update/${id}`, body);
      }
      await refresh();
    },
    [refresh]
  );

  const renameStopId = useCallback(
    async (oldId, newId) => {
      await apiPatch(`TourStops_API/rename/${oldId}`, { new_id: newId });
      if (selectedStopId === oldId) setSelectedStopId(newId);
      await refresh();
    },
    [refresh, selectedStopId]
  );

  const deleteStop = useCallback(
    async (id) => {
      await apiDelete(`TourStops_API/delete/${id}`);
      setSelectedStopId((cur) => (cur === id ? null : cur));
      await refresh();
    },
    [refresh]
  );

  // Bridges Firestore's "replace the whole neighbors array" shape onto
  // individual addNeighbor/removeNeighbor calls. In practice this is
  // only ever called with the current list plus one new id (addLink) or
  // the current list minus one id (removeLink) — never an arbitrary
  // bulk replacement — so diffing against the current state and acting
  // on just the difference correctly handles both real call sites
  // without TourNavigationEditorPage.jsx needing to change at all.
  //
  // A newly-added neighbor gets placeholder angles (0, 0) — the real
  // angle is set immediately after via setHotspot(), matching the
  // actual flow (add the link with no angle yet, then click the
  // panorama to place it).
  const setNeighbors = useCallback(
    async (id, neighborIds) => {
      const stop = stopsRef.current.find((s) => s.id === id);
      const currentIds = stop ? stop.neighbors : [];

      const added = neighborIds.filter((nid) => !currentIds.includes(nid));
      const removed = currentIds.filter((nid) => !neighborIds.includes(nid));

      for (const nid of added) {
        await apiPost("TourStops_API/addNeighbor", {
          stop_id: id,
          neighbor_id: nid,
          yaw: 0,
          pitch: 0,
          reverse_yaw: 0,
          reverse_pitch: 0,
        });
      }
      for (const nid of removed) {
        await apiPost("TourStops_API/removeNeighbor", { stop_id: id, neighbor_id: nid });
      }
      await refresh();
    },
    [refresh]
  );

  // A real, independent backend endpoint exists for this specifically
  // (updateNeighborAngle) — see TourStops_Model's own comment for why
  // addNeighbor() alone can't serve this purpose.
  const setHotspot = useCallback(
    async (stopId, neighborId, angle) => {
      await apiPatch("TourStops_API/updateNeighborAngle", {
        stop_id: stopId,
        neighbor_id: neighborId,
        yaw: angle.yaw,
        pitch: angle.pitch,
      });
      await refresh();
    },
    [refresh]
  );

  // Same diff-based bridging as setNeighbors, but three-way: an id
  // present only in the new array is a genuine ADD (backend generates
  // its own real id — see file-level note on marker id timing), an id
  // present in both but with different yaw/pitch is a REPOSITION, and
  // an id missing from the new array is a REMOVE. The marker's OWN
  // client-generated id (created upfront in TourNavigationEditorPage.jsx
  // purely to name its photos while still being picked) is discarded
  // once addMarker() returns — every later action reads whatever id is
  // currently in state, which becomes the real backend one right after
  // this refresh.
  const setMarkers = useCallback(
    async (stopId, newMarkers) => {
      const stop = stopsRef.current.find((s) => s.id === stopId);
      const currentMarkers = stop ? stop.markers : [];
      const currentIds = currentMarkers.map((m) => m.id);
      const newIds = newMarkers.map((m) => m.id);

      const added = newMarkers.filter((m) => !currentIds.includes(m.id));
      const removed = currentMarkers.filter((m) => !newIds.includes(m.id));
      const changed = newMarkers.filter((m) => {
        if (!currentIds.includes(m.id)) return false;
        const before = currentMarkers.find((cm) => cm.id === m.id);
        return before.yaw !== m.yaw || before.pitch !== m.pitch;
      });

      for (const m of added) {
        await apiPost("TourStops_API/addMarker", {
          stop_id: stopId,
          label: m.label,
          yaw: m.yaw,
          pitch: m.pitch,
          photos: m.photos || [],
        });
      }
      for (const m of changed) {
        await apiPatch(`TourStops_API/updateMarker/${m.id}`, { yaw: m.yaw, pitch: m.pitch });
      }
      for (const m of removed) {
        await apiDelete(`TourStops_API/deleteMarker/${m.id}`);
      }
      await refresh();
    },
    [refresh]
  );

  return {
    stops,
    loading,
    selectedStopId,
    setSelectedStopId,
    addStop,
    updateStop,
    renameStopId,
    deleteStop,
    setNeighbors,
    setHotspot,
    setMarkers,
  };
}
