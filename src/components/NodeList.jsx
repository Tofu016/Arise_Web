import { useMemo } from "react";
import { buildingLabel, floorLabel, typeLabel } from "../utils/constants";
import EntityListPanel from "./EntityListPanel";
import { namesOfKind, rankNodeMatches } from "../utils/search";

// `onSelectRoom` (Room and Facility Editor only) turns each node's rooms and
// facilities into pills that select that one directly; clicking the rest of the row still
// selects the node. `selectedRoom` highlights the open room's pill.
export default function NodeList({ nodes, filters, selectedNodeId, onSelect, onSelectRoom, selectedRoom, header }) {
  const filtered = useMemo(() => {
    const inScope = nodes.filter((n) => {
      if (filters.building !== "all" && n.building !== filters.building) return false;
      if (filters.floor !== "all" && String(n.floor) !== String(filters.floor)) return false;
      if (filters.type !== "all" && n.type !== filters.type) return false;
      if (filters.photoStatus === "missing" && n.photo) return false;
      if (filters.photoStatus === "has" && !n.photo) return false;
      return true;
    });
    return rankNodeMatches(filters.search, inScope);
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
      renderExtra={(n) => {
        if (!onSelectRoom) return n.rooms?.length ? <div className="node-row-rooms">Rooms: {n.rooms.join(", ")}</div> : null;
        const names = [...(n.rooms || []), ...namesOfKind(n, "facility").filter((f) => !(n.rooms || []).includes(f))];
        if (!names.length) return null;
        return (
          <div className="node-row-room-pills">
            {names.map((r) => (
              <button
                key={r}
                type="button"
                className={
                  "node-row-room-pill" +
                  (n.id === selectedNodeId && r === selectedRoom ? " node-row-room-pill-active" : "")
                }
                onClick={(e) => {
                  e.stopPropagation(); // the row's own click would select the node instead
                  onSelectRoom(n.id, r);
                }}
              >
                {r}
              </button>
            ))}
          </div>
        );
      }}
      emptyMessage="No nodes match this filter."
      header={header}
    />
  );
}
