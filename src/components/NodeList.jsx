import { useMemo } from "react";
import { buildingLabel, floorLabel, typeLabel } from "../utils/constants";
import EntityListPanel from "./EntityListPanel";

export default function NodeList({ nodes, filters, selectedNodeId, onSelect }) {
  const filtered = useMemo(() => {
    return nodes.filter((n) => {
      if (filters.building !== "all" && n.building !== filters.building) return false;
      if (filters.floor !== "all" && String(n.floor) !== String(filters.floor)) return false;
      if (filters.type !== "all" && n.type !== filters.type) return false;
      if (filters.photoStatus === "missing" && n.photo) return false;
      if (filters.photoStatus === "has" && !n.photo) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const matchesId = n.id.toLowerCase().includes(q);
        const matchesName = n.name.toLowerCase().includes(q);
        const matchesRoom = (n.rooms || []).some((r) => r.toLowerCase().includes(q));
        if (!matchesId && !matchesName && !matchesRoom) return false;
      }
      return true;
    });
  }, [nodes, filters]);

  return (
    <EntityListPanel
      label="Nodes"
      allItems={nodes}
      filteredItems={filtered}
      selectedId={selectedNodeId}
      onSelect={onSelect}
      renderMeta={(n) => (
        <>
          {buildingLabel(n.building)} · {floorLabel(n.floor)} · {typeLabel(n.type)}
          {n.neighbors?.length ? ` · ${n.neighbors.length} links` : " · unlinked"}
        </>
      )}
      renderExtra={(n) =>
        n.rooms?.length > 0 && <div className="node-row-rooms">Rooms: {n.rooms.join(", ")}</div>
      }
      emptyMessage="No nodes match this filter."
    />
  );
}
