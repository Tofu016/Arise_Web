import { useLayoutEffect, useState } from "react";
import IconPlaceholder from "../IconPlaceholder";
import { niceTicks, shortDate } from "../../utils/analyticsSeries";
import starFilledIcon from "../../assets/icons/star-filled.svg";

// Hand-rolled SVG chart primitives for the Analytics dashboard: no
// charting library in this project (see package.json), and none of these
// need one. Mark specs (bar thickness, rounded data-ends, gap widths,
// sequential ramp) follow the dataviz skill's references/marks-and-anatomy.md
// and references/color-formula.md, using this app's own brand tokens
// (--accent/--gold, plus the maroon tint ramp) rather than an invented
// palette; see tokens.css's own "reference the semantic aliases" rule.

const SEQUENTIAL_RAMP = [
  "var(--accent-tint)", // sdca-maroon-tint-2, lightest
  "var(--selected-bg)", // sdca-maroon-tint
  "var(--accent)", // sdca-maroon
  "var(--accent-hover)", // sdca-maroon-dark
  "var(--sdca-maroon-deeper)", // darkest; no semantic alias exists for this step
];

function sequentialColor(ratio) {
  if (ratio <= 0) return "var(--surface-sunken)";
  const step = Math.min(SEQUENTIAL_RAMP.length - 1, Math.floor(ratio * SEQUENTIAL_RAMP.length));
  return SEQUENTIAL_RAMP[step];
}

// Bounded empty state shared by every chart, so an empty section still
// holds its card's shape instead of leaving one line of text floating in
// whitespace next to a full sibling card.
export function EmptyState({ icon = "bar-chart", children }) {
  return (
    <div className="analytics-empty">
      <IconPlaceholder name={icon} className="analytics-empty-icon" />
      <p className="analytics-empty-text">{children}</p>
    </div>
  );
}

// delta: { label, tone } where tone is "good" | "bad" | "neutral". The
// arrow carries direction and the text says it too, so tone color is
// never the only signal (dataviz: "color = direction x whether up is good").
export function StatTile({ label, value, delta, sub }) {
  return (
    <div className="analytics-stat-tile">
      <span className="analytics-stat-label">{label}</span>
      <span className="analytics-stat-value">{value}</span>
      {delta && <span className={`analytics-stat-delta analytics-stat-delta-${delta.tone}`}>{delta.label}</span>}
      {sub && <span className="analytics-stat-sub">{sub}</span>}
    </div>
  );
}

// Width of a bar that leaves room for its value label past the tip:
// ratio of the track minus a fixed label gutter, so the longest bar's
// label still fits inside the row instead of overflowing it.
function barWidth(ratio) {
  return `calc((100% - 48px) * ${Math.max(ratio, 0)})`;
}

// Ranked horizontal bars, single hue: used for Top Destinations, Top
// Searches and the building heatmap's ranked list. One series, so no legend
// (per the skill: "a single series needs no legend box"). Each item needs a
// unique `key`, since labels (node names) aren't guaranteed unique. Value
// sits at the bar tip rather than in a far-right column, so it reads as
// belonging to its bar.
export function RankedBarChart({ items, emptyHint, emptyIcon, columns = 1 }) {
  if (!items.length) return <EmptyState icon={emptyIcon}>{emptyHint}</EmptyState>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div
      className={"analytics-bar-list" + (columns === 2 ? " analytics-bar-list-columns" : "")}
      role="table"
      aria-label="Ranked bar chart"
    >
      {items.map((item) => (
        <div className="analytics-bar-row" key={item.key} role="row" title={`${item.label}: ${item.value}`}>
          <span className="analytics-bar-row-label" role="rowheader">
            {item.label}
          </span>
          <div className="analytics-bar-track" role="cell">
            <div className="analytics-bar-fill" style={{ width: barWidth(item.value / max) }} />
            <span className="analytics-bar-value">{item.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// Funnel: cumulative session counts per stage, each stage's own drop-off
// from the previous one called out directly (that drop-off IS the point of
// a funnel; a plain bar chart of the same counts would bury it).
export function FunnelChart({ stages }) {
  if (!stages.length) return <EmptyState>No sessions tracked yet in this range.</EmptyState>;
  const first = stages[0].count || 1;
  return (
    <div className="analytics-funnel" role="table" aria-label="Session funnel">
      {stages.map((stage, i) => {
        const prev = i > 0 ? stages[i - 1].count : null;
        const dropOff = prev ? Math.round(((prev - stage.count) / prev) * 100) : null;
        const label = FUNNEL_LABELS[stage.stage] || stage.stage;
        return (
          <div key={stage.stage} className="analytics-funnel-row" role="row" title={`${label}: ${stage.count}`}>
            <span className="analytics-funnel-label" role="rowheader">
              {label}
            </span>
            <div className="analytics-bar-track analytics-funnel-track" role="cell">
              <div className="analytics-bar-fill" style={{ width: barWidth(stage.count / first) }} />
              <span className="analytics-bar-value">{stage.count}</span>
            </div>
            <span className="analytics-funnel-dropoff" role="cell">
              {dropOff !== null && dropOff > 0 ? `-${dropOff}% here` : ""}
            </span>
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
// two-brand-hue pair (accent/gold, validated CVD ΔE 26.3, see the
// Analytics planning notes), with a 2px surface gap between them and
// direct value labels. Gold alone fails contrast against the surface,
// so it's never the only way the value is conveyed.
export function SplitMeter({ walk, jump }) {
  if (!walk && !jump) return <EmptyState>No moves tracked yet in this range.</EmptyState>;
  const total = walk + jump;
  const walkPct = (walk / total) * 100;
  return (
    <div className="analytics-split-meter">
      <div className="analytics-split-meter-track">
        <div className="analytics-split-meter-segment analytics-split-meter-walk" style={{ width: `${walkPct}%` }} />
        <div className="analytics-split-meter-segment analytics-split-meter-jump" style={{ width: `${100 - walkPct}%` }} />
      </div>
      <div className="analytics-split-meter-legend">
        <span className="analytics-legend-item">
          <span className="analytics-legend-swatch analytics-swatch-walk" /> Walk: {walk} ({Math.round(walkPct)}%)
        </span>
        <span className="analytics-legend-item">
          <span className="analytics-legend-swatch analytics-swatch-jump" /> Jump: {jump} ({100 - Math.round(walkPct)}%)
        </span>
      </div>
    </div>
  );
}

// Rating distribution: vertical columns, one per star rating (1-5), the
// deliberately different organizer from every other section's horizontal
// ranked bars, so "how ratings are spread out" reads as its own kind of
// chart rather than one more entry in a list of bars. `counts` is the
// { "1": n, ..., "5": n } object Feedback_API/ratingCounts returns.
// Columns -> value on the cap (marks-and-anatomy.md), star icon as the
// x-axis tick instead of a bare number, since this is a rating scale.
export function RatingDistributionChart({ counts, emptyHint }) {
  const ratings = [1, 2, 3, 4, 5];
  const values = ratings.map((r) => counts?.[r] ?? 0);
  const total = values.reduce((sum, v) => sum + v, 0);
  if (!total) return <EmptyState icon="chat-bubble">{emptyHint}</EmptyState>;
  const max = Math.max(...values, 1);
  return (
    <div className="analytics-rating-columns" role="table" aria-label="Feedback count by star rating">
      {ratings.map((rating, i) => {
        const count = values[i];
        return (
          <div className="analytics-rating-column" role="row" key={rating} title={`${rating} star: ${count}`}>
            <span className="analytics-rating-column-value">{count}</span>
            <div className="analytics-rating-column-track">
              <div
                className="analytics-rating-column-fill"
                style={{ height: count ? `${Math.max((count / max) * 100, 4)}%` : 0 }}
              />
            </div>
            <span className="analytics-rating-column-label">
              {rating}
              <img src={starFilledIcon} alt="stars" className="analytics-rating-star-icon" />
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Tracks the rendered width of a container, so the trend chart draws at
// its real pixel size. A fixed viewBox scaled down by CSS also scales its
// text down, which is what left the old axis labels unreadably small.
// A callback ref (element kept in state) rather than useRef, since the
// container only mounts once there's enough data to chart, which can be
// well after the first render.
function useElementWidth() {
  const [element, setElement] = useState(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!element) return;
    // ResizeObserver reports once as soon as observing starts, so this
    // also covers the initial measurement.
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return [setElement, width];
}

// Evenly spaced indexes for x-axis labels, always including the first and
// last point, capped so labels never crowd each other.
function xLabelIndexes(count, maxLabels) {
  if (count <= maxLabels) return [...Array(count).keys()];
  const step = (count - 1) / (maxLabels - 1);
  return [...new Set(Array.from({ length: maxLabels }, (_, i) => Math.round(i * step)))];
}

// Sessions-over-time line: single series, 2px line, >=8px end marker,
// y-axis with round ticks and recessive gridlines, and a crosshair plus
// tooltip on hover (dataviz interaction.md: line charts ship one by default).
export function TrendLineChart({ series, valueKey = "sessions", label = "Sessions" }) {
  const [wrapRef, width] = useElementWidth();
  const [hoverIndex, setHoverIndex] = useState(null);

  if (series.length < 2) {
    return <EmptyState>Not enough days in range yet to chart a trend.</EmptyState>;
  }

  const height = 220;
  const padding = { top: 16, right: 16, bottom: 32, left: 44 };
  const innerW = Math.max(width - padding.left - padding.right, 1);
  const innerH = height - padding.top - padding.bottom;
  const values = series.map((d) => d[valueKey]);
  const ticks = niceTicks(Math.max(...values));
  const yMax = ticks[ticks.length - 1];
  const xAt = (i) => padding.left + (i / (series.length - 1)) * innerW;
  const yAt = (v) => padding.top + innerH - (v / yMax) * innerH;
  const points = series.map((d, i) => ({ x: xAt(i), y: yAt(d[valueKey]), d }));
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const baseline = padding.top + innerH;
  const areaPath = `${path} L ${points[points.length - 1].x.toFixed(1)} ${baseline} L ${points[0].x.toFixed(1)} ${baseline} Z`;
  const last = points[points.length - 1];
  const labelIndexes = xLabelIndexes(series.length, Math.max(2, Math.floor(innerW / 80)));
  // Per-day dots only while they stay distinct; past that the line alone reads better.
  const showDots = innerW / series.length >= 12;
  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - padding.left;
    const i = Math.round((x / innerW) * (series.length - 1));
    setHoverIndex(Math.min(series.length - 1, Math.max(0, i)));
  };

  return (
    <div ref={wrapRef} className="analytics-trend-wrap">
      {width > 0 && (
        <svg
          width={width}
          height={height}
          className="analytics-trend-svg"
          role="img"
          aria-label={`${label} per day, ${shortDate(series[0].date)} to ${shortDate(last.d.date)}`}
          onMouseMove={onMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padding.left} x2={width - padding.right} y1={yAt(t)} y2={yAt(t)} className="analytics-grid-line" />
              <text x={padding.left - 8} y={yAt(t)} textAnchor="end" dominantBaseline="middle" className="analytics-axis-text">
                {t.toLocaleString()}
              </text>
            </g>
          ))}
          {labelIndexes.map((i) => (
            <text
              key={i}
              x={xAt(i)}
              y={height - 10}
              textAnchor={i === 0 ? "start" : i === series.length - 1 ? "end" : "middle"}
              className="analytics-axis-text"
            >
              {shortDate(series[i].date)}
            </text>
          ))}
          <path d={areaPath} className="analytics-trend-area" />
          <path d={path} className="analytics-trend-line" />
          {showDots &&
            points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="4" className="analytics-trend-dot" />)}
          <circle cx={last.x} cy={last.y} r="5" className="analytics-trend-dot analytics-trend-dot-end" />
          {!hovered && (
            <text x={last.x - 8} y={last.y - 12} textAnchor="end" className="analytics-trend-end-label">
              {last.d[valueKey]}
            </text>
          )}
          {hovered && (
            <g pointerEvents="none">
              <line x1={hovered.x} x2={hovered.x} y1={padding.top} y2={baseline} className="analytics-crosshair" />
              <circle cx={hovered.x} cy={hovered.y} r="5" className="analytics-trend-dot analytics-trend-dot-end" />
            </g>
          )}
          <rect x={padding.left} y={padding.top} width={innerW} height={innerH} fill="transparent" />
        </svg>
      )}
      {hovered && (
        <div
          className="analytics-tooltip"
          style={{
            left: Math.min(Math.max(hovered.x, 70), width - 70),
            top: Math.max(hovered.y - 12, 0),
          }}
        >
          <span className="analytics-tooltip-label">{shortDate(hovered.d.date)}</span>
          <span className="analytics-tooltip-value">
            {hovered.d[valueKey]} {label.toLowerCase()}
          </span>
        </div>
      )}
    </div>
  );
}

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = [...Array(24).keys()];

// Day-of-week x hour-of-day timing heatmap: sequential ramp (one hue,
// light to dark). Always all 24 hours, so the axis is a real continuous
// clock; showing only hours that had activity put 0:00 right next to
// 12:00, and with so few columns the square cells grew to fill the
// section's width, stretching seven rows to several screens tall. Cells
// now have a fixed height and only their width flexes.
export function TimingHeatmap({ cells }) {
  if (!cells.length) return <EmptyState>No activity tracked yet in this range.</EmptyState>;
  const byKey = new Map(cells.map((c) => [`${c.dow}-${c.hour}`, c.count]));
  const max = Math.max(...cells.map((c) => c.count), 1);

  return (
    <div className="analytics-heatmap-wrap">
      <div className="analytics-heatmap-grid" role="table" aria-label="Activity by day of week and hour">
        <div />
        {HOURS.map((h) => (
          <div key={h} className="analytics-heatmap-hour-label" aria-hidden="true">
            {h % 3 === 0 ? `${h}:00` : ""}
          </div>
        ))}
        {DOW_LABELS.map((dowLabel, dow) => (
          <div key={dow} role="row" style={{ display: "contents" }}>
            <div className="analytics-heatmap-dow-label" role="rowheader">
              {dowLabel}
            </div>
            {HOURS.map((h) => {
              const count = byKey.get(`${dow}-${h}`) || 0;
              return (
                <div
                  key={h}
                  role="cell"
                  className="analytics-heatmap-cell"
                  style={{ background: sequentialColor(count / max) }}
                  title={`${dowLabel} ${h}:00 to ${h + 1}:00: ${count} event${count === 1 ? "" : "s"}`}
                  aria-label={`${dowLabel} ${h}:00, ${count} event${count === 1 ? "" : "s"}`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="analytics-heatmap-legend" aria-hidden="true">
        <span>Fewer</span>
        {["var(--surface-sunken)", ...SEQUENTIAL_RAMP].map((color) => (
          <span key={color} className="analytics-heatmap-legend-swatch" style={{ background: color }} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
