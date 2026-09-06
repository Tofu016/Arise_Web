import { useRef } from "react";
import { importNodesFromFile, downloadBackup } from "../utils/exportImport";

export default function ExportImportBar({ nodes, onImport }) {
  const fileInputRef = useRef();

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importNodesFromFile(file);
      onImport(imported);
    } catch (err) {
      alert(err.message);
    } finally {
      e.target.value = "";
    }
  };

  return (
    <div className="export-import-bar">
      <span className="node-count">{nodes.length} nodes</span>

      {/* Firestore syncs on every mutation individually — there's no "connect
          a file" step and nothing to debounce, just a status badge. */}
      <span className="sync-badge sync-ok">☁️ Synced to Firebase</span>

      <button onClick={() => downloadBackup(nodes)} className="subtle">Download backup</button>
      <button onClick={handleImportClick} className="subtle">Import JSON</button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
    </div>
  );
}
