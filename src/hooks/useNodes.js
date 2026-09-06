import { useState, useEffect, useCallback, useRef } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "../utils/apiClient";

// Rewritten to call Nodes_API instead of Firestore. Public interface
// (nodes, selectedNodeId, addNode, updateNode, renameNodeId, deleteNode,
// setNeighbors, setHotspot, setMarkers, loadNodes) is kept unchanged —
// AdminLayout.jsx calls this once and shares it via Outlet context
// across NodeEditorPage.jsx, NavigationEditorPage.jsx, and
// NodeFlowchartPage.jsx, none of which need any changes of their own.
//
// Genuinely more involved than useTourStops.js in three ways:
//  - rooms: a plain array of room-name strings, synced against the
//    backend's node_rooms child table the same diff-based way
//    setNeighbors/setMarkers already work, but triggered from inside
//    addNode/updateNode rather than its own separate function, since
//    that's how NodeForm.jsx's handleSave always sent it (as part of
//    the whole draft, not a dedicated add/removeRoom call site).
//  - leadsToFloor / flowchartPosition: two fields NodeForm.jsx and
//    NodeFlowchartPage.jsx actually use that the original schema never
//    accounted for at all — added via migration, translated here.
//  - markers have no photos at all, unlike tour_stops' equipment
//    markers — genuinely simpler on that one axis.
//
// loadNodes (Import JSON) is deliberately NOT implemented yet — a real,
// separate bulk-replace operation across nodes+neighbors+markers+rooms
// all at once, explicitly deferred per the confirmed scope decision.
// It's still exposed here (so destructuring it doesn't break anything)
// but throws a clear error if actually called, rather than silently
// doing nothing.

function toFrontendNode(row) {
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
  }));

  const rooms = (row.rooms || []).map((r) => r.room_name);

  const flowchartPosition =
    row.flowchart_position_x !== null && row.flowchart_position_y !== null
      ? { x: row.flowchart_position_x, y: row.flowchart_position_y }
      : null;

  return {
    id: row.id,
    name: row.name,
    building: row.building,
    floor: row.floor,
    type: row.type,
    leadsToFloor: row.leads_to_floor !== null ? row.leads_to_floor : null,
    photo: row.photo_path || "",
    rooms,
    neighbors,
    hotspots,
    markers,
    flowchartPosition,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function useNodes() {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState(null);

  const nodesRef = useRef([]);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const refresh = useCallback(async () => {
    try {
      const data = await apiGet("Nodes_API/getAll");
      setNodes(data.nodes.map(toFrontendNode));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Diffs a node's current room list against a new one, calling
  // addRoom/removeRoom for just the difference — same reasoning as
  // setNeighbors/setMarkers below: NodeForm.jsx only ever sends a
  // genuinely different full list (rooms added or removed via chips),
  // never something requiring a true arbitrary bulk replace.
  const syncRooms = useCallback(async (nodeId, newRooms) => {
    const node = nodesRef.current.find((n) => n.id === nodeId);
    const currentRooms = node ? node.rooms : [];

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
      const freshNode = freshData.nodes.find((n) => n.id === nodeId);
      const freshRooms = freshNode ? freshNode.rooms : [];
      for (const roomName of removedNames) {
        const match = freshRooms.find((r) => r.room_name === roomName);
        if (match) {
          await apiDelete(`Nodes_API/removeRoom/${match.id}`);
        }
      }
    }
  }, []);

  const addNode = useCallback(
    async (item) => {
      await apiPost("Nodes_API/create", {
        id: item.id,
        name: item.name,
        building: item.building,
        floor: item.floor,
        type: item.type,
        photo_path: item.photo || undefined,
        leads_to_floor: item.leadsToFloor ?? undefined,
      });
      if (item.rooms && item.rooms.length > 0) {
        for (const roomName of item.rooms) {
          await apiPost("Nodes_API/addRoom", { node_id: item.id, room_name: roomName });
        }
      }
      await refresh();
    },
    [refresh]
  );

  const updateNode = useCallback(
    async (id, patch) => {
      const body = {};
      if (patch.name !== undefined) body.name = patch.name;
      if (patch.building !== undefined) body.building = patch.building;
      if (patch.floor !== undefined) body.floor = patch.floor;
      if (patch.type !== undefined) body.type = patch.type;
      if (patch.photo !== undefined) body.photo_path = patch.photo;
      if (patch.leadsToFloor !== undefined) body.leads_to_floor = patch.leadsToFloor;
      if (patch.flowchartPosition !== undefined) {
        body.flowchart_position_x = patch.flowchartPosition ? patch.flowchartPosition.x : null;
        body.flowchart_position_y = patch.flowchartPosition ? patch.flowchartPosition.y : null;
      }

      if (Object.keys(body).length > 0) {
        await apiPatch(`Nodes_API/update/${id}`, body);
      }
      if (patch.rooms !== undefined) {
        await syncRooms(id, patch.rooms);
      }
      await refresh();
    },
    [refresh, syncRooms]
  );

  const renameNodeId = useCallback(
    async (oldId, newId) => {
      await apiPatch(`Nodes_API/rename/${oldId}`, { new_id: newId });
      setSelectedNodeId((cur) => (cur === oldId ? newId : cur));
      await refresh();
    },
    [refresh]
  );

  const deleteNode = useCallback(
    async (id) => {
      await apiDelete(`Nodes_API/delete/${id}`);
      setSelectedNodeId((cur) => (cur === id ? null : cur));
      await refresh();
    },
    [refresh]
  );

  // Same bridging as useTourStops.js's setNeighbors — see that file's
  // own comment for the full reasoning. Newly-added links get
  // placeholder (0, 0) angles; the real angle is set right after via
  // setHotspot().
  const setNeighbors = useCallback(
    async (id, neighborIds) => {
      const node = nodesRef.current.find((n) => n.id === id);
      const currentIds = node ? node.neighbors : [];

      const added = neighborIds.filter((nid) => !currentIds.includes(nid));
      const removed = currentIds.filter((nid) => !neighborIds.includes(nid));

      for (const nid of added) {
        await apiPost("Nodes_API/addNeighbor", {
          node_id: id,
          neighbor_id: nid,
          yaw: 0,
          pitch: 0,
          reverse_yaw: 0,
          reverse_pitch: 0,
        });
      }
      for (const nid of removed) {
        await apiPost("Nodes_API/removeNeighbor", { node_id: id, neighbor_id: nid });
      }
      await refresh();
    },
    [refresh]
  );

  const setHotspot = useCallback(
    async (nodeId, neighborId, angle) => {
      await apiPatch("Nodes_API/updateNeighborAngle", {
        node_id: nodeId,
        neighbor_id: neighborId,
        yaw: angle.yaw,
        pitch: angle.pitch,
      });
      await refresh();
    },
    [refresh]
  );

  // Same three-way diff as useTourStops.js's setMarkers, minus photo
  // handling entirely — node markers never had any.
  const setMarkers = useCallback(
    async (nodeId, newMarkers) => {
      const node = nodesRef.current.find((n) => n.id === nodeId);
      const currentMarkers = node ? node.markers : [];
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
        await apiPost("Nodes_API/addMarker", {
          node_id: nodeId,
          type: m.type,
          label: m.label,
          yaw: m.yaw,
          pitch: m.pitch,
        });
      }
      for (const m of changed) {
        await apiPatch(`Nodes_API/updateMarker/${m.id}`, { yaw: m.yaw, pitch: m.pitch });
      }
      for (const m of removed) {
        await apiDelete(`Nodes_API/deleteMarker/${m.id}`);
      }
      await refresh();
    },
    [refresh]
  );

  const loadNodes = useCallback(async () => {
    throw new Error(
      "Import JSON isn't available yet on the new backend — this is a real, separate bulk-replace operation across nodes, neighbors, markers, and rooms all at once, deliberately deferred to its own later pass rather than rushed as part of the core conversion."
    );
  }, []);

  return {
    nodes,
    loading,
    selectedNodeId,
    setSelectedNodeId,
    addNode,
    updateNode,
    renameNodeId,
    deleteNode,
    setNeighbors,
    setHotspot,
    setMarkers,
    loadNodes,
  };
}
