// Returns a Promise<node[]> from a File (e.g. from an <input type="file"> change event)
export function importNodesFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const nodes = Array.isArray(parsed) ? parsed : parsed.nodes;
        if (!Array.isArray(nodes)) {
          reject(new Error("File does not contain a valid nodes array."));
          return;
        }
        resolve(nodes);
      } catch (err) {
        reject(new Error("Could not parse JSON file: " + err.message));
      }
    };
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsText(file);
  });
}

// Triggers a browser download of the current node list as a point-in-time
// JSON snapshot — a manual backup independent of whatever the live data
// source is (useful even though Firestore itself doesn't need "saving").
export function downloadBackup(nodes) {
  const blob = new Blob([JSON.stringify(nodes, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `nodes-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
