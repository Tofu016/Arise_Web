import { useState } from "react";
import { useSecurePhotoUrl } from "../hooks/useSecurePhotoUrl";

// One thumbnail — its own component specifically so useSecurePhotoUrl
// (a hook) can be called once per item; hooks can't run inside a loop
// directly, so ArchiveBar itself never calls this hook, only renders
// one of these per visited node.
function ArchiveThumbnail({ node, onPick }) {
  const { url } = useSecurePhotoUrl(node.photo);
  return (
    <button type="button" className="archive-thumb" onClick={() => onPick(node.id)} title={node.name}>
      {url ? (
        <img src={url} alt={node.name} className="archive-thumb-img" />
      ) : (
        <span className="archive-thumb-placeholder" />
      )}
      <span className="archive-thumb-label">{node.name}</span>
    </button>
  );
}

// A collapsible strip of every node visited this session (see
// MainPage.jsx's own visitedNodeIds tracking) — genuinely session-only,
// nothing persisted, resets on a page reload. currentNodeId is excluded
// from the list itself: showing the place you're already looking at as
// a clickable "jump here" thumbnail would just be a no-op.
export default function ArchiveBar({ visitedNodeIds, currentNodeId, byId, onPick }) {
  const [open, setOpen] = useState(false);

  const nodes = visitedNodeIds
    .filter((id) => id !== currentNodeId)
    .map((id) => byId[id])
    .filter(Boolean)
    .reverse(); // most recently visited first

  if (nodes.length === 0) return null;

  return (
    <div className={"archive-bar" + (open ? " archive-bar-open" : "")}>
      <button
        type="button"
        className="archive-bar-toggle"
        onClick={() => setOpen((o) => !o)}
        title={open ? "Collapse visited places" : "Show visited places"}
      >
        {open ? "▾" : "▸"} Visited ({nodes.length})
      </button>
      {open && (
        <div className="archive-bar-strip">
          {nodes.map((node) => (
            <ArchiveThumbnail key={node.id} node={node} onPick={onPick} />
          ))}
        </div>
      )}
    </div>
  );
}
