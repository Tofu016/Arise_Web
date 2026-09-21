// A ring that drains over `total` seconds around the time left. Under a
// minute shows plain seconds; longer shows m:ss.
function formatRemaining(seconds) {
  if (seconds < 60) return String(seconds);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function CountdownRing({ total, remaining }) {
  const text = formatRemaining(remaining);
  return (
    <span
      className={"countdown-ring" + (text.length > 2 ? " countdown-ring-wide" : "")}
      style={{ "--countdown-seconds": `${total}s` }}
    >
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <circle className="countdown-ring-track" cx="18" cy="18" r="16" />
        <circle className="countdown-ring-bar" cx="18" cy="18" r="16" pathLength="100" />
      </svg>
      <span className="countdown-ring-number">{text}</span>
    </span>
  );
}
