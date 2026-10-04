// Kiosk-only: a card in the top-left corner, underneath the header band,
// listing the nearest rooms/facilities to the visitor's current node.
// `style` carries the caller's vertical placement (see MainPage.jsx).
// `onSelect` is called with the tapped entry (MainPage opens its room card).
export default function NearbyRoomsPanel({ rooms, currentFloor, onSelect, style }) {
  if (!rooms || rooms.length === 0) return null;

  return (
    <div className="nearby-rooms-panel" style={style}>
      <h4 className="nearby-rooms-title">Nearby</h4>
      <ul className="nearby-rooms-list">
        {rooms.map((r) => (
          <li key={r.room}>
            <button
              type="button"
              className="nearby-rooms-item"
              onClick={() => onSelect?.(r)}
            >
              <span className="nearby-rooms-name">{r.room}</span>
              <span className="nearby-rooms-meta">
                {r.floor !== currentFloor ? `Fl. ${r.floor}` : r.hops === 0 ? "Here" : `${r.hops} hop${r.hops === 1 ? "" : "s"}`}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
