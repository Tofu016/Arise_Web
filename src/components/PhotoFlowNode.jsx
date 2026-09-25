import { useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { useSecurePhotoUrl } from "../hooks/useSecurePhotoUrl";
import { buildingLabel, floorLabel } from "../utils/constants";

// Each node fetches its own photo independently through the same secure
// pipeline used everywhere else in the admin (getBytes() through Storage
// Security Rules, not a public download URL) — parallel fetches across
// however many nodes are in the selected building/floor.
//
// Deliberately a flat <img>, not the interactive 360° sphere viewer
// (PanoramaNav) — this is a structural overview meant to be scanned
// quickly across many nodes at once, not explored one at a time.
export default function PhotoFlowNode({ data }) {
  const { url } = useSecurePhotoUrl(data.photo);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="flowchart-node"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Handle type="target" position={Position.Left} />

      {hovered && (
        <div className="flowchart-node-tooltip">
          <div className="flowchart-tooltip-row">
            <span className="flowchart-tooltip-key">ID</span>
            <span className="flowchart-tooltip-val">{data.nodeId}</span>
          </div>
          <div className="flowchart-tooltip-row">
            <span className="flowchart-tooltip-key">Building</span>
            <span className="flowchart-tooltip-val">{buildingLabel(data.building)}</span>
          </div>
          <div className="flowchart-tooltip-row">
            <span className="flowchart-tooltip-key">Floor</span>
            <span className="flowchart-tooltip-val">{floorLabel(data.floor)}</span>
          </div>
          <div className="flowchart-tooltip-row">
            <span className="flowchart-tooltip-key">Type</span>
            <span className="flowchart-tooltip-val">{data.nodeType || "N/A"}</span>
          </div>
          <div className="flowchart-tooltip-row">
            <span className="flowchart-tooltip-key">Rooms served</span>
            <span className="flowchart-tooltip-val">
              {data.rooms && data.rooms.length > 0 ? data.rooms.join(", ") : "None"}
            </span>
          </div>
        </div>
      )}

      <div className="flowchart-node-thumb">
        {data.photo ? (
          url ? (
            <img src={url} alt={data.label} />
          ) : (
            <div className="flowchart-node-loading">…</div>
          )
        ) : (
          <div className="flowchart-node-missing">No photo</div>
        )}
      </div>
      <div className="flowchart-node-label" title={data.label}>
        {data.label}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
