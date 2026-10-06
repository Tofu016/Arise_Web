export default function ExportImportBar({ nodes }) {
  return (
    <div className="export-import-bar">
      <span className="node-count">{nodes.length} nodes</span>
    </div>
  );
}
