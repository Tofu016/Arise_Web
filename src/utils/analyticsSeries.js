// "YYYY-MM-DD" day arithmetic done in UTC, so a local DST shift can never
// skip or repeat a calendar day.
function parseDay(day) {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function formatDay(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

const DAY_MS = 24 * 60 * 60 * 1000;

// The backend only returns days that had sessions, so a quiet stretch would
// otherwise be drawn as a straight line between its neighbours. Returns one
// entry per calendar day from `from` (or the first returned day) to `to`
// (or the last returned day), with `zero` filling the gaps. `to` is capped
// at `today` so a future end date doesn't pad the chart with empty days.
export function fillDateGaps(series, { from, to, today, zero }) {
  if (!series.length && !(from && to)) return series;
  const byDate = new Map(series.map((d) => [d.date, d]));
  const start = parseDay(from || series[0].date);
  let end = parseDay(to || series[series.length - 1].date);
  if (today) end = Math.min(end, parseDay(today));

  const filled = [];
  for (let t = start; t <= end; t += DAY_MS) {
    const date = formatDay(t);
    filled.push(byDate.get(date) || { date, ...zero });
  }
  return filled;
}

export function localToday(now = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function shiftDay(day, days) {
  return formatDay(parseDay(day) + days * DAY_MS);
}

// The dashboard's default range: the last `days` calendar days, today
// included. A bounded default is what gives the KPI cards a previous
// period to compare against; "all time" has none.
export function defaultDateRange(today, days = 30) {
  return { from: shiftDay(today, -(days - 1)), to: today };
}

// The equally long stretch of days immediately before from..to, or null
// when either end is open (no fixed length to mirror).
export function previousPeriod({ from, to }) {
  if (!from || !to || from > to) return null;
  const length = Math.round((parseDay(to) - parseDay(from)) / DAY_MS) + 1;
  return { from: shiftDay(from, -length), to: shiftDay(from, -1) };
}

export function periodLength({ from, to }) {
  return Math.round((parseDay(to) - parseDay(from)) / DAY_MS) + 1;
}

// KPI delta against the previous period. kind "relative" is a % change
// (counts, durations); kind "points" is a percentage-point change, for
// values that are already rates (0-1), where a relative % of a % misleads.
// higherIsBetter picks the tone. Returns null when there's no baseline to
// compare against (missing value, or a relative change from zero).
export function kpiDelta(current, previous, { kind = "relative", higherIsBetter = true } = {}) {
  if (current === null || current === undefined || previous === null || previous === undefined) return null;
  let change;
  let label;
  if (kind === "points") {
    change = Math.round((current - previous) * 100);
    label = `${Math.abs(change)} pts`;
  } else {
    if (previous === 0) return null;
    change = Math.round(((current - previous) / previous) * 100);
    label = `${Math.abs(change)}%`;
  }
  if (change === 0) return { label: "No change", tone: "neutral" };
  const up = change > 0;
  return {
    label: `${up ? "\u2191" : "\u2193"} ${label}`,
    tone: up === higherIsBetter ? "good" : "bad",
  };
}

// Clean round ticks (0 / 5 / 10, 0 / 20 / 40, ...) for a count axis that
// starts at zero. Steps never go below 1, since sessions are whole numbers.
export function niceTicks(max, target = 4) {
  const rawStep = Math.max(max, 1) / target;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const niceStep = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
  const step = Math.max(1, niceStep);
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks = [];
  for (let t = 0; t <= top; t += step) ticks.push(t);
  return ticks;
}

// "2026-09-28" -> "Sep 28". Read as UTC so the label never shifts a day
// in timezones west of UTC.
export function shortDate(day) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
