import { useMemo } from "react";

export default function NeighborPicker({ nodes, currentNodeId, building, floor, selected, onChange }) {
  const options = useMemo(() => {
    return nodes.filter((n) => {
      if (n.id === currentNodeId) return false;
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
          </label>
        ))}
      </div>
    </div>
  );
}
