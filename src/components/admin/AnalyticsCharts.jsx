// Hand-rolled SVG chart primitives for the Analytics dashboard — no
// charting library in this project (see package.json), and none of these
// need one. Mark specs (bar thickness, rounded data-ends, gap widths,
// sequential ramp) follow the dataviz skill's references/marks-and-anatomy.md
// and references/color-formula.md, using this app's own brand tokens
// (--accent/--gold, plus the maroon tint ramp) rather than an invented
// palette — see tokens.css's own "reference the semantic aliases" rule.

const SEQUENTIAL_RAMP = [
  "var(--accent-tint)", // sdca-maroon-tint-2, lightest
  "var(--selected-bg)", // sdca-maroon-tint
  "var(--accent)", // sdca-maroon
  "var(--accent-hover)", // sdca-maroon-dark
  "var(--sdca-maroon-deeper)", // darkest — no semantic alias exists for this step
];

function sequentialColor(ratio) {
  if (ratio <= 0) return "var(--surface-sunken)";
  const step = Math.min(SEQUENTIAL_RAMP.length - 1, Math.floor(ratio * SEQUENTIAL_RAMP.length));
  return SEQUENTIAL_RAMP[step];
}

export function StatTile({ label, value, sub }) {
  return (
    <div className="analytics-stat-tile">
      <span className="analytics-stat-label">{label}</span>
      <span className="analytics-stat-value">{value}</span>
      {sub && <span className="analytics-stat-sub">{sub}</span>}
    </div>
  );
}

// Ranked horizontal bars, single hue — used for Most Searched Rooms and
// the building heatmap's ranked list. One series, so no legend (per the
// skill: "a single series needs no legend box").
export function RankedBarChart({ items, emptyHint }) {
  if (!items.length) return <p className="empty-hint">{emptyHint}</p>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="analytics-bar-list" role="table" aria-label="Ranked bar chart">
      {items.map((item) => (
        <div className="analytics-bar-row" key={item.label} role="row">
          <span className="analytics-bar-row-label" title={item.label}>
            {item.label}
          </span>
          <div className="analytics-bar-track">
            <div className="analytics-bar-fill" style={{ width: `${Math.max((item.value / max) * 100, 3)}%` }} />
          </div>
          <span className="analytics-bar-row-value">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

// Funnel: cumulative session counts per stage, each stage's own drop-off
// from the previous one called out directly (that drop-off IS the point of
// a funnel — a plain bar chart of the same counts would bury it).
export function FunnelChart({ stages }) {
  if (!stages.length) return null;
  const first = stages[0].count || 1;
  return (
    <div className="analytics-funnel" role="table" aria-label="Session funnel">
      {stages.map((stage, i) => {
        const pctOfFirst = Math.round((stage.count / first) * 100);
        const prev = i > 0 ? stages[i - 1].count : null;
        const dropOff = prev ? Math.round(((prev - stage.count) / (prev || 1)) * 100) : null;
        return (
          <div key={stage.stage} className="analytics-funnel-row">
            <span className="analytics-funnel-label">{FUNNEL_LABELS[stage.stage] || stage.stage}</span>
            <div className="analytics-funnel-track">
              <div className="analytics-funnel-fill" style={{ width: `${Math.max(pctOfFirst, 2)}%` }}>
                <span className="analytics-funnel-fill-value">{stage.count}</span>
              </div>
            </div>
            {dropOff !== null && dropOff > 0 && (
              <span className="analytics-funnel-dropoff">-{dropOff}% here</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

const FUNNEL_LABELS = {
  start: "Start screen",
  campus: "Campus chosen",
  building: "Building chosen",
  floor: "Floor chosen",
  exploring: "Exploring",
  feedback: "Gave feedback",
};

// A single bar split into two segments (walk / jump), the app's own
// two-brand-hue pair (accent/gold — validated CVD ΔE 26.3, see the
// Analytics planning notes), with a 2px surface gap between them and
// direct value labels — gold alone fails contrast against the surface,
// so it's never the only way the value is conveyed.
export function SplitMeter({ walk, jump }) {
  const total = walk + jump || 1;
  const walkPct = (walk / total) * 100;
  return (
    <div className="analytics-split-meter">
      <div className="analytics-split-meter-track">
        <div className="analytics-split-meter-segment analytics-split-meter-walk" style={{ width: `${walkPct}%` }} />
        <div className="analytics-split-meter-segment analytics-split-meter-jump" style={{ width: `${100 - walkPct}%` }} />
      </div>
      <div className="analytics-split-meter-legend">
        <span className="analytics-legend-item">
          <span className="analytics-legend-swatch analytics-swatch-walk" /> Walk: {walk}
        </span>
        <span className="analytics-legend-item">
          <span className="analytics-legend-swatch analytics-swatch-jump" /> Jump: {jump}
        </span>
        <span className="analytics-split-meter-ratio">
          {jump > 0 ? `${(walk / jump).toFixed(2)} : 1` : "—"}
        </span>
      </div>
    </div>
  );
}

// Sessions-over-time line — single series, 2px line, >=8px end marker,
// sparse axis labels (first/last/max only, not every point).
export function TrendLineChart({ series, valueKey = "sessions", label = "Sessions" }) {
  if (series.length < 2) {
    return <p className="empty-hint">Not enough days in range yet to chart a trend.</p>;
  }
  const width = 640;
  const height = 160;
  const padding = { top: 12, right: 12, bottom: 24, left: 12 };
  const values = series.map((d) => d[valueKey]);
  const max = Math.max(...values, 1);
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const points = series.map((d, i) => {
    const x = padding.left + (i / (series.length - 1)) * innerW;
    const y = padding.top + innerH - (d[valueKey] / max) * innerH;
    return { x, y, d };
  });
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${path} L ${points[points.length - 1].x.toFixed(1)} ${padding.top + innerH} L ${points[0].x.toFixed(1)} ${padding.top + innerH} Z`;
  const last = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="analytics-trend-svg" role="img" aria-label={`${label} over time`}>
      <line
        x1={padding.left}
        y1={padding.top + innerH}
        x2={width - padding.right}
        y2={padding.top + innerH}
        className="analytics-axis-line"
      />
      <path d={areaPath} className="analytics-trend-area" />
      <path d={path} className="analytics-trend-line" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4" className="analytics-trend-dot">
          <title>{`${p.d.date}: ${p.d[valueKey]}`}</title>
        </circle>
      ))}
      <circle cx={last.x} cy={last.y} r="5" className="analytics-trend-dot analytics-trend-dot-end" />
      <text x={padding.left} y={height - 4} className="analytics-axis-text">
        {series[0].date}
      </text>
      <text x={width - padding.right} y={height - 4} textAnchor="end" className="analytics-axis-text">
        {series[series.length - 1].date}
      </text>
      <text x={last.x} y={last.y - 10} textAnchor="end" className="analytics-trend-end-label">
        {last.d[valueKey]}
      </text>
    </svg>
  );
}

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Day-of-week x hour-of-day timing heatmap — sequential ramp (one hue,
// light to dark), cells sparse (only hours with any activity get a
// column) so a mostly-idle 24-hour range doesn't render as a wall of
// empty cells.
export function TimingHeatmap({ cells }) {
  if (!cells.length) return <p className="empty-hint">No activity tracked yet in this range.</p>;
  const byKey = new Map(cells.map((c) => [`${c.dow}-${c.hour}`, c.count]));
  const activeHours = [...new Set(cells.map((c) => c.hour))].sort((a, b) => a - b);
  const max = Math.max(...cells.map((c) => c.count), 1);

  return (
    <div className="analytics-heatmap-wrap">
      <div className="analytics-heatmap-grid" style={{ gridTemplateColumns: `56px repeat(${activeHours.length}, 1fr)` }}>
        <div />
        {activeHours.map((h) => (
          <div key={h} className="analytics-heatmap-hour-label">
            {h}:00
          </div>
        ))}
        {DOW_LABELS.map((dowLabel, dow) => (
          <div key={dow} className="analytics-heatmap-row-contents" style={{ display: "contents" }}>
            <div className="analytics-heatmap-dow-label">{dowLabel}</div>
            {activeHours.map((h) => {
              const count = byKey.get(`${dow}-${h}`) || 0;
              return (
                <div
                  key={h}
                  className="analytics-heatmap-cell"
                  style={{ background: sequentialColor(count / max) }}
                  title={`${dowLabel} ${h}:00 — ${count} event${count === 1 ? "" : "s"}`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
