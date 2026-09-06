import { useMemo } from "react";

// Building Transition nodes connect GD2<->GD3 across building boundaries, so
// they must stay selectable as a neighbor regardless of which building/floor
// filter is currently active — otherwise they'd be invisible in the list
// exactly when you need to link to one.
export default function NeighborPicker({ nodes, currentNodeId, building, floor, selected, onChange }) {
  const options = useMemo(() => {
    return nodes.filter((n) => {
      if (n.id === currentNodeId) return false;
      if (n.type === "portal") return true;
      return n.building === building && n.floor === floor;
    });
  }, [nodes, currentNodeId, building, floor]);

  const toggle = (id) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="neighbor-picker">
      <label>Neighbors ({selected.length} selected)</label>
      <div className="neighbor-list">
        {options.length === 0 && <p className="empty-hint">No other nodes on this floor yet.</p>}
        {options.map((n) => (
          <label key={n.id} className="neighbor-item">
            <input
              type="checkbox"
              checked={selected.includes(n.id)}
              onChange={() => toggle(n.id)}
            />
            <span>{n.name}</span>
            <span className="neighbor-id">{n.id}</span>
            {n.type === "portal" && <span className="portal-tag">building transition</span>}
          </label>
        ))}
      </div>
    </div>
  );
}
