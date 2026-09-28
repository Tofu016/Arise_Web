import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useAnalyticsDashboard } from "../../hooks/useAnalyticsDashboard";
import { useFeedback } from "../../hooks/useFeedback";
import { allBuildings, buildingLabel } from "../../utils/constants";
import {
  StatTile,
  RankedBarChart,
  FunnelChart,
  SplitMeter,
  TrendLineChart,
  TimingHeatmap,
} from "../../components/admin/AnalyticsCharts";

function formatDate(createdAt) {
  if (!createdAt) return "N/A";
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function Stars({ rating }) {
  return (
    <span className="feedback-admin-stars" aria-label={`${rating} out of 5`}>
      {"★".repeat(rating)}
      <span className="feedback-admin-stars-empty">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// Filter row shared by every chart section below (KPI cards, funnel,
// trends, rooms/routes, walk/jump, heatmaps) — the Comments section has
// its own additional filters (rating, has-comment) layered on top, since
// those don't apply to the behavioral sections at all.
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

function Section({ title, hint, loading, error, children }) {
  return (
    <section className="analytics-section">
      <h3 className="analytics-section-heading">{title}</h3>
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
  const { summary, funnel, rooms, routes, movement, trends, heatmap } = useAnalyticsDashboard(filters);

  // Comments section: its own rating/has-comment filters layered on the
  // shared date range (see Feedback_Model::getAll) — platform/building
  // don't apply to app feedback at all, so they're left out here.
  const [minRating, setMinRating] = useState("");
  const [hasComment, setHasComment] = useState("");
  const { feedback, loading: feedbackLoading, markReviewed } = useFeedback({
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

  const roomLabel = (nodeId) => byId[nodeId]?.name || nodeId;
  const roomsChartItems = (rooms.data?.rooms || []).map((r) => ({ label: roomLabel(r.node_id), value: r.count }));
  const routesItems = routes.data?.routes || [];
  const buildingItems = (heatmap.data?.buildings || []).map((b) => ({
    label: buildingLabel(b.building),
    value: b.count,
  }));

  return (
    <div className="analytics-page">
      <h2 className="admin-page-heading">Analytics</h2>
      <p className="field-hint">
        Kiosk and desktop visitor behavior, plus feedback comments. A kiosk session runs from the attract screen
        to feedback (or an idle restart); a desktop session runs for as long as the tab stays active.
      </p>

      <FilterBar filters={filters} setFilters={setFilters} buildings={buildings} />

      <div className="analytics-stat-row">
        <StatTile label="Sessions" value={summary.data?.sessionCount ?? "—"} />
        <StatTile label="Avg. duration" value={formatDuration(summary.data?.avgDurationSeconds)} />
        <StatTile
          label="Feedback rate"
          value={summary.data ? `${Math.round(summary.data.feedbackRate * 100)}%` : "—"}
        />
        <StatTile
          label="Walk : Jump"
          value={summary.data?.walkJumpRatio !== null && summary.data?.walkJumpRatio !== undefined ? `${summary.data.walkJumpRatio} : 1` : "—"}
        />
      </div>

      <Section
        title="Session funnel"
        hint={filters.platform === "desktop" ? "Desktop has no campus/building/floor gate — it starts already exploring." : "Defaults to kiosk sessions, where the campus/building/floor gate makes drop-off meaningful."}
        loading={funnel.loading}
        error={funnel.error}
      >
        <FunnelChart stages={funnel.data?.stages || []} />
      </Section>

      <Section title="Sessions over time" loading={trends.loading} error={trends.error}>
        <TrendLineChart series={trends.data?.series || []} valueKey="sessions" label="Sessions" />
      </Section>

      <div className="analytics-section-grid">
        <Section
          title="Most searched rooms"
          hint="By go-to taps and directions requests, resolved against the current node list."
          loading={rooms.loading}
          error={rooms.error}
        >
          <RankedBarChart items={roomsChartItems} emptyHint="No room activity tracked yet in this range." />
        </Section>

        <Section title="Most common routes" loading={routes.loading} error={routes.error}>
          {routesItems.length === 0 ? (
            <p className="empty-hint">No directions requested yet in this range.</p>
          ) : (
            <div className="analytics-bar-list">
              {routesItems.map((r, i) => (
                <div className="analytics-bar-row" key={i}>
                  <span className="analytics-bar-row-label">
                    {roomLabel(r.from_node_id)} → {roomLabel(r.to_node_id)}
                  </span>
                  <span className="analytics-bar-row-value">{r.count}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      <Section title="Walk vs. jump" loading={movement.loading} error={movement.error}>
        <SplitMeter walk={movement.data?.totals?.walk || 0} jump={movement.data?.totals?.jump || 0} />
      </Section>

      <div className="analytics-section-grid">
        <Section
          title="Building heatmap"
          hint="Visit density by building — ranked, since node/room coordinates aren't tracked for a true map overlay yet."
          loading={heatmap.loading}
          error={heatmap.error}
        >
          <RankedBarChart items={buildingItems} emptyHint="No building activity tracked yet in this range." />
        </Section>

        <Section title="When people visit" hint="Day of week × hour of day." loading={heatmap.loading} error={heatmap.error}>
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

        {feedbackLoading ? (
          <p className="field-hint">Loading…</p>
        ) : sortedFeedback.length === 0 ? (
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
