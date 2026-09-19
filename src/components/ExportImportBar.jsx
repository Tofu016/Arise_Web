// Triggers a browser download of the current node list as a point-in-time
// JSON snapshot — a manual backup independent of the live data. It is a
// read-only snapshot in the app's own node shape; there is no import to
// restore it with.
function downloadBackup(nodes) {
  const blob = new Blob([JSON.stringify(nodes, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `nodes-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportImportBar({ nodes }) {
  return (
    <div className="export-import-bar">
      <span className="node-count">{nodes.length} nodes</span>

      {/* Every mutation is persisted to the backend as it happens — there's
          no "connect a file" step and nothing to debounce, just a status badge. */}
      <span className="sync-badge sync-ok">☁️ Auto-saved</span>

      <button onClick={() => downloadBackup(nodes)} className="subtle">Download backup</button>
    </div>
  );
}
