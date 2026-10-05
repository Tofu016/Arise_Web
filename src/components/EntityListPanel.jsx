// Shared row-list rendering behind NodeList.jsx and RoomList.jsx —
// both show the same "photo dot + name + one meta line (+ optional extra
// line)" row, over a header reporting how many of the full set matched
// the current filter and how many have a photo. Each caller keeps its
// own filtering logic (the two domains filter on different fields
// entirely), and only hands this component the already-filtered list
// plus how to render its meta line. `header`, when given, replaces the
// default counts header (the Room Editor puts its Rooms/Nodes switch there).
export default function EntityListPanel({
  label,
  allItems,
  filteredItems,
  selectedId,
  onSelect,
  renderMeta,
  renderExtra,
  emptyMessage,
  header,
}) {
  const photoCount = allItems.filter((it) => it.photo).length;

  return (
    <div className="panel node-list-panel">
      {header ?? (
        <div className="node-list-header">
          <h3>{label} ({filteredItems.length} of {allItems.length})</h3>
          <span className="photo-progress">{photoCount}/{allItems.length} have photos</span>
        </div>
      )}
      <div className="node-list">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className={`node-row ${item.id === selectedId ? "selected" : ""}`}
            onClick={() => onSelect(item.id)}
          >
            <span
              className={`photo-dot ${item.photo ? "has-photo" : "no-photo"}`}
              title={item.photo ? "Has photo" : "No photo yet"}
            />
            <div className="node-row-main">
              <div className="node-row-name">{item.name}</div>
              <div className="node-row-meta">{renderMeta(item)}</div>
              {renderExtra?.(item)}
            </div>
          </div>
        ))}
        {filteredItems.length === 0 && <p className="empty-hint">{emptyMessage}</p>}
      </div>
    </div>
  );
}
