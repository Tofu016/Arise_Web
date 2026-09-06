import { useState, useEffect, useCallback } from "react";
import { apiGet } from "../utils/apiClient";

// Rewritten to call Nodes_API instead of Firestore. Read-only, same as
// before — MainPage.jsx has no CRUD needs here, unlike useNodes.js which
// the admin editor uses. Same field-name translation as useNodes.js's
// own toFrontendNode (backend snake_case -> the camelCase this app has
// always used), duplicated rather than shared, since this hook is
// intentionally much smaller in scope than the full admin one.
//
// No live subscription anymore — confirmed early in this migration that
// reload-to-see-updates is fine, replacing Firestore's onSnapshot. This
// does mean an admin's edit won't appear to an already-open visitor
// without a refresh, unlike before — a real, deliberate trade-off
// already made, not something this file reintroduces on its own.

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
  };
}

export function usePublicNodes() {
  const [nodes, setNodes] = useState(null); // null while loading, matching the original contract
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const data = await apiGet("Nodes_API/getAll");
      setNodes(data.nodes.map(toFrontendNode));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { nodes, error };
}
