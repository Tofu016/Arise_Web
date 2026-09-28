import { useEffect, useRef, useState } from "react";
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
  // Doesn't request its photo until this node has actually scrolled/zoomed
  // into view — with hundreds of nodes in scope (e.g. "All floors"), fetching
  // every one on mount means every one of them firing a multi-MB panorama
  // fetch+decode at once. Stays true once seen, so panning away and back
  // never drops the already-loaded photo.
  const [visible, setVisible] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (visible) return;
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  const { url } = useSecurePhotoUrl(visible ? data.photo : null);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      ref={containerRef}
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
