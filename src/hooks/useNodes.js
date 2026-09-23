import { useState, useCallback } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "../utils/apiClient";
import { toNode, nodeCreateBody, nodePatchBody } from "../utils/entities";
import { NODE_GRAPH, planNeighbors, planHotspot, planDefaultView, planClearDefaultView, planMarkers, runCalls } from "../utils/graphSync";
import { useCollection } from "./useCollection";

// Admin-side Nodes_API hook. Public interface (nodes, loading,
// selectedNodeId, addNode, updateNode, renameNodeId, deleteNode,
// setNeighbors, setHotspot, setMarkers) — AdminLayout.jsx calls
// this once and shares it via Outlet context across the editor pages.
//
// Wire mapping lives in utils/entities.js and the neighbor/hotspot/marker
// diffing in utils/graphSync.js (shared with useTourStops); what's left
// here is what's specific to nodes: rooms, and the selection.

async function loadAll() {
  const data = await apiGet("Nodes_API/getAll");
  return data.nodes.map(toNode);
}

export function useNodes() {
  const { items: nodes, loading, mutate, itemsRef: nodesRef } = useCollection(loadAll);
  const [selectedNodeId, setSelectedNodeId] = useState(null);

  const nodeById = useCallback((id) => nodesRef.current.find((n) => n.id === id), [nodesRef]);

  // Diffs a node's current room list against a new one, calling
  // addRoom/removeRoom for just the difference — NodeForm.jsx only ever
  // sends a genuinely different full list (rooms added or removed via
  // chips), never something requiring an arbitrary bulk replace.
  const syncRooms = useCallback(
    async (nodeId, newRooms) => {
      const currentRooms = nodeById(nodeId)?.rooms ?? [];

      const added = newRooms.filter((r) => !currentRooms.includes(r));
      const removedNames = currentRooms.filter((r) => !newRooms.includes(r));

      for (const roomName of added) {
        await apiPost("Nodes_API/addRoom", { node_id: nodeId, room_name: roomName });
      }

      // Removal needs the actual row id, not just the name — one fresh
      // fetch covers every removal in this call, rather than one fetch
      // per room.
      if (removedNames.length > 0) {
        const freshData = await apiGet("Nodes_API/getAll");
        const freshRooms = freshData.nodes.find((n) => n.id === nodeId)?.rooms ?? [];
        for (const roomName of removedNames) {
          const match = freshRooms.find((r) => r.room_name === roomName);
          if (match) {
            await apiDelete(`Nodes_API/removeRoom/${match.id}`);
          }
        }
      }
    },
    [nodeById]
  );

  const addNode = useCallback(
    (item) =>
      mutate(async () => {
        await apiPost("Nodes_API/create", nodeCreateBody(item));
        await syncRooms(item.id, item.rooms || []); // a new node has no rooms yet, so all are added
        // startingNode/campusEntrance/buildingEntrance aren't part of
        // create's own body (see nodeCreateBody) since they're
        // uniqueness-scoped flags the model clears elsewhere on write —
        // sent as a follow-up patch instead, one call covering all three
        // when any is set.
        const flagPatch = {};
        if (item.startingNode) flagPatch.is_starting_node = 1;
        if (item.campusEntrance) flagPatch.is_campus_entrance = 1;
        if (item.buildingEntrance) flagPatch.is_building_entrance = 1;
        if (Object.keys(flagPatch).length > 0) {
          await apiPatch(`Nodes_API/update/${item.id}`, flagPatch);
        }
      }),
    [mutate, syncRooms]
  );

  const updateNode = useCallback(
    (id, patch) =>
      mutate(async () => {
        const body = nodePatchBody(patch);
        if (Object.keys(body).length > 0) {
          await apiPatch(`Nodes_API/update/${id}`, body);
        }
        if (patch.rooms !== undefined) {
          await syncRooms(id, patch.rooms);
        }
      }),
    [mutate, syncRooms]
  );

  const renameNodeId = useCallback(
    (oldId, newId) =>
      mutate(async () => {
        await apiPatch(`Nodes_API/rename/${oldId}`, { new_id: newId });
        setSelectedNodeId((cur) => (cur === oldId ? newId : cur));
      }),
    [mutate]
  );

  // Applies a planBuildingMove() plan: per node, switch the building, then
  // rename its id (the backend cascades the rename to neighbors, markers and
  // rooms). One refetch at the end.
  const moveNodesToBuilding = useCallback(
    (moves, toBuilding) =>
      mutate(async () => {
        for (const { id, newId } of moves) {
          await apiPatch(`Nodes_API/update/${id}`, { building: toBuilding });
          if (newId !== id) {
            await apiPatch(`Nodes_API/rename/${id}`, { new_id: newId });
          }
        }
      }),
    [mutate]
  );

  const deleteNode = useCallback(
    (id) =>
      mutate(async () => {
        await apiDelete(`Nodes_API/delete/${id}`);
        setSelectedNodeId((cur) => (cur === id ? null : cur));
      }),
    [mutate]
  );

  const setNeighbors = useCallback(
    (id, neighborIds) =>
      mutate(() => runCalls(planNeighbors(NODE_GRAPH, id, nodeById(id)?.neighbors ?? [], neighborIds))),
    [mutate, nodeById]
  );

  const setHotspot = useCallback(
    (nodeId, neighborId, angle) => mutate(() => runCalls(planHotspot(NODE_GRAPH, nodeId, neighborId, angle))),
    [mutate]
  );

  const setMarkers = useCallback(
    (nodeId, newMarkers) =>
      mutate(() => runCalls(planMarkers(NODE_GRAPH, nodeId, nodeById(nodeId)?.markers ?? [], newMarkers))),
    [mutate, nodeById]
  );

  const setDefaultView = useCallback(
    (nodeId, neighborId, angle) => mutate(() => runCalls(planDefaultView(NODE_GRAPH, nodeId, neighborId, angle))),
    [mutate]
  );

  const clearDefaultView = useCallback(
    (nodeId, neighborId) => mutate(() => runCalls(planClearDefaultView(NODE_GRAPH, nodeId, neighborId))),
    [mutate]
  );

  return {
    nodes,
    loading,
    selectedNodeId,
    setSelectedNodeId,
    addNode,
    updateNode,
    renameNodeId,
    moveNodesToBuilding,
    deleteNode,
    setNeighbors,
    setHotspot,
    setMarkers,
    setDefaultView,
    clearDefaultView,
  };
}
