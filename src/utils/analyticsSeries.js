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
