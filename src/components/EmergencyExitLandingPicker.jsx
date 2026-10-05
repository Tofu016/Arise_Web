import { useState } from "react";
import { floorLabel } from "../utils/constants";
import { landingCandidates } from "../utils/emergencyExits";

// Picks the landing nodes of an emergency exit marker: where the hidden fire
// stairs behind its door come out. Lists the other floors of the same building,
// lowest first, since that is the order Nearest Exit prefers them in. An empty
// pick is valid for a fire door that leads straight outside (the node is then
// ticked as an Emergency Exit Destination Point instead).
export default function EmergencyExitLandingPicker({ node, nodes, selected, onChange }) {
  const [query, setQuery] = useState("");
  const candidates = landingCandidates(nodes, node, query);
  const floors = [...new Set(candidates.map((n) => Number(n.floor)))];

  const toggle = (id) => onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  // A landing that no longer exists (a deleted node) can only be unticked.
  const orphans = selected.filter((id) => !nodes.some((n) => n.id === id));

  return (
    <div className="landing-picker">
      <p className="field-hint">
        Where do the hidden fire stairs behind this door come out? Tick every floor the stairwell reaches:
        Nearest Exit takes the lowest first, and the others are the way round when "This way is blocked" is
        reported. Leave empty for a fire door that leads straight outside.
      </p>
      <input
        type="text"
        placeholder="Filter by name or ID…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="landing-picker-list navigation-editor-scroll-list">
        {candidates.length === 0 && <p className="empty-hint">No nodes on other floors of this building match.</p>}
        {floors.map((floor) => (
          <div key={floor} className="landing-picker-floor">
            <h6>{floorLabel(floor)}</h6>
            {candidates
              .filter((n) => Number(n.floor) === floor)
              .map((n) => (
                <label key={n.id} className="elevator-floor-checkbox">
                  <input type="checkbox" checked={selected.includes(n.id)} onChange={() => toggle(n.id)} />
                  {n.name} <span className="elevator-picker-sub">({n.id})</span>
                </label>
              ))}
          </div>
        ))}
        {orphans.map((id) => (
          <label key={id} className="elevator-floor-checkbox">
            <input type="checkbox" checked onChange={() => toggle(id)} />
            {id} <span className="elevator-picker-sub">(no longer exists)</span>
          </label>
        ))}
      </div>
      <p className="field-hint">{selected.length} landing(s) ticked.</p>
    </div>
  );
}
