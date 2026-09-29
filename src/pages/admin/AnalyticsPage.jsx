import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useAnalyticsDashboard } from "../../hooks/useAnalyticsDashboard";
import { useFeedback } from "../../hooks/useFeedback";
import { allBuildings, buildingLabel } from "../../utils/constants";
import { fillDateGaps, localToday } from "../../utils/analyticsSeries";
import {
  StatTile,
  RankedBarChart,
  FunnelChart,
  SplitMeter,
  TrendLineChart,
  TimingHeatmap,
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

function formatWalkShare(summary) {
  const total = (summary?.walkCount || 0) + (summary?.jumpCount || 0);
  if (!total) return EMPTY_VALUE;
  return `${Math.round((summary.walkCount / total) * 100)}%`;
}

// Filter row shared by every chart section below (KPI cards, funnel,
// trends, destinations/searches/routes, walk/jump, heatmaps). The Comments
// section has its own additional filters (rating, has-comment) layered on
// top, since those don't apply to the behavioral sections at all.
function FilterBar({ filters, setFilters, buildings }) {
  const set = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));
  return (
    <div className="analytics-filter-bar">
      <label className="analytics-filter-field">
        From
        <input type="date" value={filters.from} onChange={set("from")} />
      </label>
      <label className="analytics-filter-field">
        To
        <input type="date" value={filters.to} onChange={set("to")} />
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
      {(filters.from || filters.to || filters.platform || filters.building) && (
        <button
          type="button"
          className="analytics-filter-clear"
          onClick={() => setFilters({ from: "", to: "", platform: "", building: "" })}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

function Section({ title, hint, loading, updating, error, children }) {
  return (
    <section className={"analytics-section" + (updating ? " analytics-section-updating" : "")} aria-busy={updating}>
      <h3 className="analytics-section-heading">
        {title}
        {updating && <span className="analytics-section-updating-label">Updating…</span>}
      </h3>
      {hint && <p className="field-hint">{hint}</p>}
      {error ? (
        <p className="error-box-inline">{error}</p>
      ) : loading ? (
        <p className="field-hint">Loading…</p>
      ) : (
        children
      )}
    </section>
  );
}

export default function AnalyticsPage() {
  const { nodes } = useOutletContext();
  const byId = useMemo(() => Object.fromEntries((nodes || []).map((n) => [n.id, n])), [nodes]);
  const buildings = useMemo(() => allBuildings(), []);

  const [filters, setFilters] = useState({ from: "", to: "", platform: "", building: "" });
  const { summary, funnel, rooms, searches, routes, movement, trends, heatmap } = useAnalyticsDashboard(filters);

  // Comments section: its own rating/has-comment filters layered on the
  // shared date range (see Feedback_Model::getAll). Platform/building
  // don't apply to app feedback at all, so they're left out here.
  const [minRating, setMinRating] = useState("");
  const [hasComment, setHasComment] = useState("");
  const { feedback, loading: feedbackLoading, error: feedbackError, markReviewed } = useFeedback({
    from: filters.from,
    to: filters.to,
    minRating,
    hasComment,
  });
  const unreviewedCount = feedback.filter((f) => !f.reviewed_at).length;
  const sortedFeedback = [...feedback].sort((a, b) => {
    if (!a.reviewed_at && b.reviewed_at) return -1;
    if (a.reviewed_at && !b.reviewed_at) return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });

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

  return (
    <div className="analytics-page">
      <h2 className="admin-page-heading">Analytics</h2>
      <p className="field-hint">
        Kiosk and desktop visitor behavior, plus feedback comments. A kiosk session runs from the first tap past the
        attract screen until an idle restart or the post-feedback reset; a desktop session runs until feedback or 30
        minutes without activity.
      </p>

      <FilterBar filters={filters} setFilters={setFilters} buildings={buildings} />

      <div className={"analytics-stat-row" + (summary.updating ? " analytics-section-updating" : "")}>
        <StatTile label="Sessions" value={summary.data?.sessionCount ?? EMPTY_VALUE} />
        <StatTile label="Avg. duration" value={formatDuration(summary.data?.avgDurationSeconds)} />
        <StatTile
          label="Feedback rate"
          value={summary.data ? `${Math.round(summary.data.feedbackRate * 100)}%` : EMPTY_VALUE}
        />
        <StatTile label="Moves that were walks" value={formatWalkShare(summary.data)} />
      </div>

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

      <Section title="Sessions over time" loading={trends.loading} updating={trends.updating} error={trends.error}>
        <TrendLineChart series={trendSeries} valueKey="sessions" label="Sessions" />
      </Section>

      <div className="analytics-section-grid">
        <Section
          title="Top destinations"
          hint="Places visitors chose from search, a room card or Nearby, plus directions destinations."
          loading={rooms.loading}
          updating={rooms.updating}
          error={rooms.error}
        >
          <RankedBarChart items={destinationItems} emptyHint="No destinations chosen yet in this range." />
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
          <RankedBarChart items={searchItems} emptyHint="No searches tracked yet in this range." />
        </Section>
      </div>

      <div className="analytics-section-grid">
        <Section title="Most common routes" loading={routes.loading} updating={routes.updating} error={routes.error}>
          {routesItems.length === 0 ? (
            <p className="empty-hint">No directions requested yet in this range.</p>
          ) : (
            <div className="analytics-bar-list">
              {routesItems.map((r) => (
                <div className="analytics-bar-row" key={`${r.from_node_id}|${r.to_node_id}`}>
                  <span className="analytics-bar-row-label analytics-route-label">
                    {nodeLabel(r.from_node_id)}
                    <img src={chevronRightIcon} alt="to" className="analytics-route-icon" />
                    {nodeLabel(r.to_node_id)}
                  </span>
                  <span className="analytics-bar-row-value">{r.count}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Walk vs. jump" loading={movement.loading} updating={movement.updating} error={movement.error}>
          <SplitMeter walk={movement.data?.totals?.walk || 0} jump={movement.data?.totals?.jump || 0} />
        </Section>
      </div>

      <div className="analytics-section-grid">
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
          title="When people visit"
          hint="Day of week × hour of day."
          loading={heatmap.loading}
          updating={heatmap.updating}
          error={heatmap.error}
        >
          <TimingHeatmap cells={heatmap.data?.timing || []} />
        </Section>
      </div>

      <section className="analytics-section">
        <h3 className="analytics-section-heading">
          Comments
          {unreviewedCount > 0 && <span className="badge-count">{unreviewedCount} new</span>}
        </h3>
        <div className="analytics-filter-bar">
          <label className="analytics-filter-field">
            Min. rating
            <select value={minRating} onChange={(e) => setMinRating(e.target.value)}>
              <option value="">Any</option>
              {[2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}+ stars
                </option>
              ))}
            </select>
          </label>
          <label className="analytics-filter-field">
            <input
              type="checkbox"
              checked={hasComment === "1"}
              onChange={(e) => setHasComment(e.target.checked ? "1" : "")}
            />
            Has a written comment
          </label>
        </div>

        {feedbackError && <p className="error-box-inline">Couldn't load feedback: {feedbackError}</p>}
        {feedbackLoading ? (
          <p className="field-hint">Loading…</p>
        ) : feedbackError ? null : sortedFeedback.length === 0 ? (
          <p className="empty-hint">No feedback submitted yet in this range.</p>
        ) : (
          <div className="users-list">
            {sortedFeedback.map((f) => (
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
                    <button type="button" className="primary" onClick={() => markReviewed(f.id)}>
                      Mark reviewed
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
