import { useState, useCallback } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "../utils/apiClient";
import { toStop, stopCreateBody, stopPatchBody } from "../utils/entities";
import { STOP_GRAPH, planNeighbors, planHotspot, planMarkers, runCalls } from "../utils/graphSync";
import { useCollection } from "./useCollection";

// Admin-side TourStops_API hook. Public interface (stops, loading,
// selectedStopId, setSelectedStopId, addStop, updateStop, renameStopId,
// deleteStop, setNeighbors, setHotspot, setMarkers) — TourStopsPage.jsx,
// TourNavigationEditorPage.jsx, TourStopForm.jsx and TourStopList.jsx use it.
//
// Wire mapping lives in utils/entities.js and the neighbor/hotspot/marker
// diffing in utils/graphSync.js (shared with useNodes); what's left here
// is what's specific to stops: the selection.

async function loadAll() {
  const data = await apiGet("TourStops_API/getAll");
  return data.stops.map(toStop);
}

export function useTourStops() {
  const { items: stops, loading, mutate, itemsRef: stopsRef } = useCollection(loadAll);
  const [selectedStopId, setSelectedStopId] = useState(null);

  const stopById = useCallback((id) => stopsRef.current.find((s) => s.id === id), [stopsRef]);

  // Client provides the id (TourStopForm.jsx already suggested/validated
  // one) — the backend accepts it directly rather than generating its own.
  const addStop = useCallback(
    (item) => mutate(() => apiPost("TourStops_API/create", stopCreateBody(item))),
    [mutate]
  );

  const updateStop = useCallback(
    (id, patch) =>
      mutate(async () => {
        const body = stopPatchBody(patch);
        if (Object.keys(body).length > 0) {
          await apiPatch(`TourStops_API/update/${id}`, body);
        }
      }),
    [mutate]
  );

  const renameStopId = useCallback(
    (oldId, newId) =>
      mutate(async () => {
        await apiPatch(`TourStops_API/rename/${oldId}`, { new_id: newId });
        setSelectedStopId((cur) => (cur === oldId ? newId : cur));
      }),
    [mutate]
  );

  const deleteStop = useCallback(
    (id) =>
      mutate(async () => {
        await apiDelete(`TourStops_API/delete/${id}`);
        setSelectedStopId((cur) => (cur === id ? null : cur));
      }),
    [mutate]
  );

  const setNeighbors = useCallback(
    (id, neighborIds) =>
      mutate(() => runCalls(planNeighbors(STOP_GRAPH, id, stopById(id)?.neighbors ?? [], neighborIds))),
    [mutate, stopById]
  );

  const setHotspot = useCallback(
    (stopId, neighborId, angle) => mutate(() => runCalls(planHotspot(STOP_GRAPH, stopId, neighborId, angle))),
    [mutate]
  );

  const setMarkers = useCallback(
    (stopId, newMarkers) =>
      mutate(() => runCalls(planMarkers(STOP_GRAPH, stopId, stopById(stopId)?.markers ?? [], newMarkers))),
    [mutate, stopById]
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
