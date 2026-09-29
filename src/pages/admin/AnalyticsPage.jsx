import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useAnalyticsDashboard } from "../../hooks/useAnalyticsDashboard";
import { useFeedback, useFeedbackRatingCounts } from "../../hooks/useFeedback";
import { allBuildings, buildingLabel } from "../../utils/constants";
import { defaultDateRange, fillDateGaps, kpiDelta, localToday, periodLength } from "../../utils/analyticsSeries";
import {
  EmptyState,
  StatTile,
  RankedBarChart,
  FunnelChart,
  SplitMeter,
  TrendLineChart,
  TimingHeatmap,
  RatingDistributionChart,
} from "../../components/admin/AnalyticsCharts";
import starFilledIcon from "../../assets/icons/star-filled.svg";
import starOutlineIcon from "../../assets/icons/star-outline.svg";
import chevronRightIcon from "../../assets/icons/chevron-right.svg";

const EMPTY_VALUE = "N/A";

function formatDate(createdAt) {
  if (!createdAt) return EMPTY_VALUE;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return EMPTY_VALUE;
  return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function Stars({ rating }) {
  return (
    <span className="feedback-admin-stars" role="img" aria-label={`${rating} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <img key={i} src={i < rating ? starFilledIcon : starOutlineIcon} alt="" className="feedback-admin-star-icon" />
      ))}
    </span>
  );
}

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return EMPTY_VALUE;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// Share of moves that were walks (0-1), or null when there were no moves.
function walkShare(summary) {
  const total = (summary?.walkCount || 0) + (summary?.jumpCount || 0);
  return total ? summary.walkCount / total : null;
}

const SORT_OPTIONS = [
  { value: "unreviewed", label: "Unreviewed first" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "rating_desc", label: "Highest rating" },
  { value: "rating_asc", label: "Lowest rating" },
];

const DEFAULT_RANGE_DAYS = 30;

function defaultFilters() {
  return { ...defaultDateRange(localToday(), DEFAULT_RANGE_DAYS), platform: "", building: "" };
}

// A rating-range pair (From/To, 1-5 stars each), reused by Rating
// distribution and Comments as two independent filters, each in its own
// panel rather than one shared control. Each select narrows the other's
// options so a from/to pair can't cross into an inverted range.
function RatingRangeFields({ from, to, setFrom, setTo }) {
  return (
    <>
      <label className="analytics-filter-field">
        Rating from
        <select value={from} onChange={(e) => setFrom(e.target.value)}>
          <option value="">Any</option>
          {[1, 2, 3, 4, 5]
            .filter((n) => !to || n <= Number(to))
            .map((n) => (
              <option key={n} value={n}>
                {n} star{n === 1 ? "" : "s"}
              </option>
            ))}
        </select>
      </label>
      <label className="analytics-filter-field">
        Rating to
        <select value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="">Any</option>
          {[1, 2, 3, 4, 5]
            .filter((n) => !from || n >= Number(from))
            .map((n) => (
              <option key={n} value={n}>
                {n} star{n === 1 ? "" : "s"}
              </option>
            ))}
        </select>
      </label>
    </>
  );
}

// Filter row shared by every chart section below (KPI cards, funnel,
// trends, destinations/searches/routes, walk/jump, heatmaps). Rating
// distribution and Comments each layer their own rating-range filter on
// top (see RatingRangeFields), plus Comments' own sort, since none of
// that applies to the behavioral sections.
function FilterBar({ filters, setFilters, buildings }) {
  const set = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));
  const defaults = defaultFilters();
  const isDefault = Object.keys(defaults).every((key) => filters[key] === defaults[key]);
  return (
    <div className="analytics-filter-bar">
      <label className="analytics-filter-field">
        From
        <input type="date" value={filters.from} max={filters.to || undefined} onChange={set("from")} />
      </label>
      <label className="analytics-filter-field">
        To
        <input type="date" value={filters.to} min={filters.from || undefined} onChange={set("to")} />
      </label>
      <label className="analytics-filter-field">
        Platform
        <select value={filters.platform} onChange={set("platform")}>
          <option value="">All</option>
          <option value="kiosk">Kiosk</option>
          <option value="desktop">Desktop</option>
        </select>
      </label>
      <label className="analytics-filter-field">
        Building
        <select value={filters.building} onChange={set("building")}>
          <option value="">All</option>
          {buildings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>
      </label>
      {!isDefault && (
        <button type="button" className="analytics-filter-clear" onClick={() => setFilters(defaultFilters())}>
          Reset to last {DEFAULT_RANGE_DAYS} days
        </button>
      )}
    </div>
  );
}

function Section({ title, hint, filters, badge, loading, updating, error, wide, children }) {
  return (
    <section
      className={
        "analytics-section" + (wide ? " analytics-section-wide" : "") + (updating ? " analytics-section-updating" : "")
      }
      aria-busy={updating}
    >
      <h3 className="analytics-section-heading">
        {title}
        {badge}
        {updating && <span className="analytics-section-updating-label">Updating…</span>}
      </h3>
      {hint && <p className="analytics-section-hint">{hint}</p>}
      {filters && <div className="analytics-filter-bar analytics-filter-bar-inline">{filters}</div>}
      <div className="analytics-section-body">
        {error ? (
          <p className="error-box-inline">{error}</p>
        ) : loading ? (
          <p className="analytics-section-hint">Loading…</p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

export default function AnalyticsPage() {
  const { nodes } = useOutletContext();
  const byId = useMemo(() => Object.fromEntries((nodes || []).map((n) => [n.id, n])), [nodes]);
  const buildings = useMemo(() => allBuildings(), []);

  const [filters, setFilters] = useState(defaultFilters);
  const { summary, previousSummary, funnel, rooms, searches, routes, movement, trends, heatmap } =
    useAnalyticsDashboard(filters);

  // Rating distribution and Comments each have their own rating-range
  // filter, in their own panel, layered on the shared date range; sort is
  // Comments-only, since a distribution chart has nothing to sort.
  // Platform/building don't apply to app feedback at all, so they're left
  // out of both.
  const [chartRatingFrom, setChartRatingFrom] = useState("");
  const [chartRatingTo, setChartRatingTo] = useState("");
  const { counts: ratingCounts, loading: ratingLoading, updating: ratingUpdating, error: ratingError } =
    useFeedbackRatingCounts({ from: filters.from, to: filters.to, minRating: chartRatingFrom, maxRating: chartRatingTo });

  const [commentRatingFrom, setCommentRatingFrom] = useState("");
  const [commentRatingTo, setCommentRatingTo] = useState("");
  const [sort, setSort] = useState("unreviewed");
  const {
    feedback,
    total: feedbackTotal,
    unreviewedCount,
    loading: feedbackLoading,
    updating: feedbackUpdating,
    loadingMore,
    hasMore,
    error: feedbackError,
    loadMore,
    markReviewed,
    // Comments is reserved for feedback with an actual written comment;
    // ratings left with no comment still count in the distribution chart
    // above, which has its own range and doesn't filter on this at all.
  } = useFeedback({
    from: filters.from,
    to: filters.to,
    minRating: commentRatingFrom,
    maxRating: commentRatingTo,
    hasComment: "1",
    sort,
  });

  // Deltas only while both periods answer the current filters; mid-update
  // either side can still hold the previous range's numbers.
  const current = summary.data;
  const previous = !summary.updating && !previousSummary.updating ? previousSummary.data : null;
  const compareSub = current && previous ? `vs previous ${periodLength(filters)} days` : null;
  const delta = (pick, options) => (current && previous ? kpiDelta(pick(current), pick(previous), options) : null);

  const nodeLabel = (nodeId) => byId[nodeId]?.name || nodeId;
  const destinationItems = (rooms.data?.rooms || []).map((r) => ({
    key: r.node_id,
    label: nodeLabel(r.node_id),
    value: r.count,
  }));
  const searchItems = (searches.data?.queries || []).map((q) => ({
    key: q.query,
    label: q.matched ? q.query : `${q.query} (no match)`,
    value: q.count,
  }));
  const routesItems = routes.data?.routes || [];
  const buildingItems = (heatmap.data?.buildings || []).map((b) => ({
    key: b.building,
    label: buildingLabel(b.building),
    value: b.count,
  }));
  const trendSeries = useMemo(
    () =>
      fillDateGaps(trends.data?.series || [], {
        from: filters.from,
        to: filters.to,
        today: localToday(),
        zero: { sessions: 0, feedbackRate: 0 },
      }),
    [trends.data, filters.from, filters.to]
  );
  const currentWalkShare = walkShare(current);

  return (
    <div className="analytics-page">
      <header className="analytics-page-header">
        <h2 className="admin-page-heading">Analytics</h2>
        <p className="analytics-page-intro">
          Kiosk and desktop visitor behavior, plus feedback comments. A kiosk session runs from the first tap past the
          attract screen until an idle restart or the post-feedback reset; a desktop session runs until feedback or 30
          minutes without activity.
        </p>
      </header>

      <FilterBar filters={filters} setFilters={setFilters} buildings={buildings} />

      <div className={"analytics-stat-row" + (summary.updating ? " analytics-section-updating" : "")}>
        <StatTile
          label="Sessions"
          value={current ? current.sessionCount.toLocaleString() : EMPTY_VALUE}
          delta={delta((s) => s.sessionCount)}
          sub={compareSub}
        />
        <StatTile
          label="Avg. duration"
          value={formatDuration(current?.avgDurationSeconds)}
          delta={delta((s) => s.avgDurationSeconds)}
          sub={compareSub}
        />
        <StatTile
          label="Feedback rate"
          value={current ? `${Math.round(current.feedbackRate * 100)}%` : EMPTY_VALUE}
          delta={delta((s) => (s.sessionCount ? s.feedbackRate : null), { kind: "points" })}
          sub={compareSub}
        />
        <StatTile
          label="Moves that were walks"
          value={currentWalkShare === null ? EMPTY_VALUE : `${Math.round(currentWalkShare * 100)}%`}
          delta={delta(walkShare, { kind: "points" })}
          sub={compareSub}
        />
      </div>

      <div className="analytics-grid">
        <Section title="Sessions over time" wide loading={trends.loading} updating={trends.updating} error={trends.error}>
          <TrendLineChart series={trendSeries} valueKey="sessions" label="Sessions" />
        </Section>

        <Section
          title="Session funnel"
          hint={
            filters.platform === "desktop"
              ? "Desktop has no campus/building/floor gate, so it starts already exploring."
              : "Kiosk sessions only, where the campus/building/floor gate makes drop-off meaningful."
          }
          loading={funnel.loading}
          updating={funnel.updating}
          error={funnel.error}
        >
          <FunnelChart stages={funnel.data?.stages || []} />
        </Section>

        <Section
          title="Building heatmap"
          hint="Arrivals (walks and jumps) by the building of the node arrived at. Ranked, since node coordinates aren't tracked for a true map overlay yet."
          loading={heatmap.loading}
          updating={heatmap.updating}
          error={heatmap.error}
        >
          <RankedBarChart items={buildingItems} emptyHint="No building activity tracked yet in this range." />
        </Section>

        <Section
          title="Top destinations"
          hint="Places visitors chose from search, a room card or Nearby, plus directions destinations."
          loading={rooms.loading}
          updating={rooms.updating}
          error={rooms.error}
        >
          <RankedBarChart
            items={destinationItems}
            emptyIcon="location-pin"
            emptyHint="No destinations chosen yet in this range."
          />
        </Section>

        <Section
          title="Top searches"
          hint={
            searches.data?.total
              ? `${Math.round(searches.data.noMatchRate * 100)}% of ${searches.data.total} searches found no room.`
              : "What visitors typed into room search."
          }
          loading={searches.loading}
          updating={searches.updating}
          error={searches.error}
        >
          <RankedBarChart
            items={searchItems}
            emptyIcon="search-magnifier"
            emptyHint="No searches tracked yet in this range."
          />
        </Section>

        <Section title="Most common routes" loading={routes.loading} updating={routes.updating} error={routes.error}>
          {routesItems.length === 0 ? (
            <EmptyState icon="location-pin">No directions requested yet in this range.</EmptyState>
          ) : (
            <div className="analytics-bar-list">
              {routesItems.map((r) => (
                <div className="analytics-route-row" key={`${r.from_node_id}|${r.to_node_id}`}>
                  <span className="analytics-route-label">
                    {nodeLabel(r.from_node_id)}
                    <img src={chevronRightIcon} alt="to" className="analytics-route-icon" />
                    {nodeLabel(r.to_node_id)}
                  </span>
                  <span className="analytics-route-value">{r.count}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Walk vs. jump" loading={movement.loading} updating={movement.updating} error={movement.error}>
          <SplitMeter walk={movement.data?.totals?.walk || 0} jump={movement.data?.totals?.jump || 0} />
        </Section>

        <Section
          title="Rating distribution"
          hint="Every rating in this range, comment or not, with its own rating filter below."
          filters={
            <RatingRangeFields
              from={chartRatingFrom}
              to={chartRatingTo}
              setFrom={setChartRatingFrom}
              setTo={setChartRatingTo}
            />
          }
          loading={ratingLoading}
          updating={ratingUpdating}
          error={ratingError}
        >
          <RatingDistributionChart counts={ratingCounts} emptyHint="No ratings submitted yet in this range." />
        </Section>

        <Section
          title="When people visit"
          hint="Day of week x hour of day. Darker cells had more activity."
          loading={heatmap.loading}
          updating={heatmap.updating}
          error={heatmap.error}
        >
          <TimingHeatmap cells={heatmap.data?.timing || []} />
        </Section>

        <Section
          title="Comments"
          badge={unreviewedCount > 0 && <span className="badge-count">{unreviewedCount} new</span>}
          hint="Feedback that came with a written comment, with its own rating filter below. Every rating, commented or not, is in Rating distribution above."
          wide
          filters={
            <>
              <label className="analytics-filter-field">
                Sort by
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <RatingRangeFields
                from={commentRatingFrom}
                to={commentRatingTo}
                setFrom={setCommentRatingFrom}
                setTo={setCommentRatingTo}
              />
            </>
          }
          loading={feedbackLoading}
          updating={feedbackUpdating}
          error={feedbackError}
        >
          {feedback.length === 0 ? (
            <EmptyState icon="chat-bubble">No feedback submitted yet in this range.</EmptyState>
          ) : (
            <>
              <div className="users-list">
                {feedback.map((f) => (
                  <div key={f.id} className={"users-row" + (!f.reviewed_at ? " users-row-pending" : "")}>
                    <div className="users-row-main">
                      <Stars rating={f.rating} />
                      {f.comment && <span className="feedback-admin-comment">{f.comment}</span>}
                      <span className="field-hint">
                        {formatDate(f.created_at)}
                        {(f.name || f.email) && " · "}
                        {f.name}
                        {f.name && f.email && " · "}
                        {f.email}
                        {!f.name && !f.email && " · Anonymous"}
                      </span>
                    </div>
                    <div className="users-row-actions">
                      {!f.reviewed_at && (
                        <button type="button" className="admin-btn-secondary" onClick={() => markReviewed(f.id)}>
                          Mark reviewed
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="analytics-pager">
                <span className="analytics-section-hint">
                  Showing {feedback.length} of {feedbackTotal}
                </span>
                {hasMore && (
                  <button type="button" className="admin-btn-secondary" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? "Loading…" : "Load more"}
                  </button>
                )}
              </div>
            </>
          )}
        </Section>
      </div>
    </div>
  );
}
