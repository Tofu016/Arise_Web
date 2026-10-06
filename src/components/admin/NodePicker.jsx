import { useEffect, useId, useMemo, useRef, useState } from "react";
import { fuzzyIncludes } from "../../utils/fuzzy";
import { allBuildings, floorLabel } from "../../utils/constants";

const optionText = (n) => `${n.name} (${floorLabel(n.floor)}, ${n.id})`;

function groupNodes(nodes, query) {
  const buildings = allBuildings();
  const matching = nodes.filter((n) => fuzzyIncludes(query, [n.name, n.id]));
  return [
    ...buildings.map((b) => ({ id: b.id, label: b.label, nodes: matching.filter((n) => n.building === b.id) })),
    { id: "__other", label: "Other", nodes: matching.filter((n) => !buildings.some((b) => b.id === n.building)) },
  ].filter((g) => g.nodes.length > 0);
}

// A node dropdown with a search box built in: the closed control reads like
// a select, and opening it focuses a filter over node names and ids. Options
// are grouped by building in sidebar order; a node on a building that's no
// longer listed still gets an "Other" group, or the picker couldn't show a
// room that is actually on it.
export default function NodePicker({ nodes, value, onChange, disabled = false, placeholder = "Pick a node…" }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const listId = useId();

  const selected = nodes.find((n) => n.id === value) || null;

  const groups = useMemo(() => groupNodes(nodes, query), [nodes, query]);
  const flat = groups.flatMap((g) => g.nodes);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Opening starts on the current node, so the list shows where the room is.
  const openPicker = () => {
    if (disabled) return;
    setQuery("");
    setActive(Math.max(0, groupNodes(nodes, "").flatMap((g) => g.nodes).findIndex((n) => n.id === value)));
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, groups]);

  const pick = (id) => {
    onChange(id);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (flat[active]) pick(flat[active].id);
    } else if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
    }
  };

  let index = -1;
  return (
    <div className="node-picker" ref={rootRef}>
      <button
        type="button"
        className="node-picker-toggle"
        onClick={() => (open ? setOpen(false) : openPicker())}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={"node-picker-value" + (selected ? "" : " node-picker-placeholder")}>
          {selected ? optionText(selected) : value || placeholder}
        </span>
      </button>
      {open && (
        <div className="node-picker-popover">
          <input
            type="search"
            className="node-picker-search"
            autoFocus
            placeholder="Search nodes by name or ID"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
          />
          <div className="node-picker-list" ref={listRef} id={listId} role="listbox">
            {flat.length === 0 && <p className="empty-hint">No matches.</p>}
            {groups.map((g) => (
              <div key={g.id} role="group" aria-label={g.label}>
                <div className="node-picker-group">{g.label}</div>
                {g.nodes.map((n) => {
                  index++;
                  const i = index;
                  return (
                    <div
                      key={n.id}
                      data-index={i}
                      role="option"
                      aria-selected={n.id === value}
                      className={
                        "node-picker-option" +
                        (i === active ? " node-picker-option-active" : "") +
                        (n.id === value ? " node-picker-option-selected" : "")
                      }
                      onMouseEnter={() => setActive(i)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(n.id)}
                    >
                      {n.name} <span className="neighbor-id">{floorLabel(n.floor)}, {n.id}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
