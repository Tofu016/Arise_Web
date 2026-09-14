import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useNodes } from "../hooks/useNodes";
import { useAuth } from "../context/useAuth";

// Three independent top-level groups, per the confirmed sidebar
// architecture — Virtual Map and Campus Tour each collapse to one rail
// icon and expand into their own labeled sub-items; User Panel is its
// own single rail icon with no sub-items or grouping at all, since user
// management genuinely doesn't belong to either tour.
//
// Group-level icons deliberately avoid reusing any of their own
// sub-items' icons (Virtual Map's own "Virtual Map Navigation Editor"
// already uses 🗺️, for instance) so the rail and the expanded flyout
// never show the same icon meaning two different things at two different
// levels.
const GROUPS = [
  {
    id: "indoor",
    icon: "🏢",
    label: "Virtual Map",
    items: [
      { path: "node-editor", icon: "🏠", label: "Node Editor" },
      { path: "node-flowchart", icon: "📊", label: "Node Flowchart" },
      { path: "virtual-map-navigation-editor", icon: "🗺️", label: "Virtual Map Navigation Editor" },
      { path: "room-editor", icon: "🚪", label: "Room Editor" },
    ],
  },
  {
    id: "virtual",
    icon: "🏞️",
    label: "Campus Tour",
    items: [
      { path: "tour-stops", icon: "📍", label: "Tour Stops" },
      { path: "campus-tour-navigation-editor", icon: "🗺️", label: "Campus Tour Navigation Editor" },
    ],
  },
];

const USER_PANEL = { path: "users", icon: "👤", label: "User Panel" };
const FEEDBACK = { path: "feedback", icon: "💬", label: "Feedback" };
const PHOTO_COVERAGE = { path: "photo-coverage", icon: "📊", label: "Photo Coverage" };
const PHOTOS = { path: "photos", icon: "🖼️", label: "Photos" };

// Shared shell for every admin section — header, collapsible sidebar, and
// the actual page content via <Outlet>. useNodes() is called ONCE here,
// not independently per page, and passed down through Outlet's own
// context — this is what lets a node selected in one Virtual Map section
// still be the selected node after switching to another, rather than
// every page losing track of it on navigation. The Campus Tour side's
// two pages (Description Edit and Section Editor became popups launched
// from Tour Stops rather than their own sidebar destinations) each call
// their own hooks independently for now rather than sharing through this
// same context — see this file's own history for why: useNodes() and
// useTourStops() both return same-named properties
// (setNeighbors/setHotspot/setMarkers), so naively merging them into one
// flat context object would silently let one overwrite the other, and
// fixing that properly would mean restructuring every existing Virtual
// Map page's own useOutletContext() call too — out of scope for what
// this pass is actually about.
//
// Sidebar interaction: collapsed is an icon-only rail, always visible.
// Clicking a GROUP icon expands into a flyout showing that group's own
// name as a header, followed by its labeled sub-items — picking one of
// those is what actually navigates and collapses the flyout back. User
// Panel's rail icon is a plain, direct link instead — it has no
// sub-items to show, so forcing an extra "expand, then pick the one and
// only option" step would just be a needless click with no benefit.
export default function AdminLayout() {
  const { user, profile, signOut } = useAuth();
  const nodesState = useNodes();
  // Which group's flyout is open, if any — null, or a GROUPS[].id.
  const [expandedGroupId, setExpandedGroupId] = useState(null);
  const expandedGroup = GROUPS.find((g) => g.id === expandedGroupId) || null;

  const displayName = profile?.name || user?.email || "";
  const initials = displayName
    ? displayName.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  return (
    <div className="admin-layout">
      <div className="admin-header">
        <div className="admin-header-side admin-header-nav">
          <Link to="/" className="admin-header-nav-btn primary">Back to Virtual Map</Link>
          {/* Destination now exists (the public /tour page, built in a
              prior phase) — same treatment and behavior as "Back to
              Virtual Map" above: plain in-app navigation, same tab, no
              target="_blank", for consistency between the two. */}
          <Link to="/tour" className="admin-header-nav-btn primary">Back to Virtual Tour</Link>
        </div>
        <div className="admin-header-center">
          <div className="admin-header-title-line" />
          <span className="admin-header-title">Admin Editor</span>
        </div>
        <div className="admin-header-side admin-header-account">
          <div className="account-avatar">{initials}</div>
          <span className="account-name" title={displayName}>{displayName}</span>
          <button onClick={signOut} className="subtle">Sign out</button>
        </div>
      </div>

      <div className="admin-layout-body">
        <div className="admin-sidebar-rail">
          {GROUPS.map((g) => (
            <button
              key={g.id}
              className="admin-sidebar-icon-btn"
              onClick={() => setExpandedGroupId(g.id)}
              title={g.label}
            >
              {g.icon}
            </button>
          ))}
          <Link
            to={`/admin/${USER_PANEL.path}`}
            className="admin-sidebar-icon-btn"
            title={USER_PANEL.label}
          >
            {USER_PANEL.icon}
          </Link>
          {/* Standalone, no sub-items — same reasoning as User Panel
              above: general app feedback genuinely doesn't belong to
              either the Virtual Map or Campus Tour group. */}
          <Link
            to={`/admin/${FEEDBACK.path}`}
            className="admin-sidebar-icon-btn"
            title={FEEDBACK.label}
          >
            {FEEDBACK.icon}
          </Link>
          {/* Also standalone — covers both nodes (Virtual Map) and tour
              stops (Campus Tour) together, so it genuinely doesn't
              belong to either single group either. */}
          <Link
            to={`/admin/${PHOTO_COVERAGE.path}`}
            className="admin-sidebar-icon-btn"
            title={PHOTO_COVERAGE.label}
          >
            {PHOTO_COVERAGE.icon}
          </Link>
          {/* Standalone too, same reasoning as Photo Coverage above —
              covers every photo type, not tied to one group. */}
          <Link
            to={`/admin/${PHOTOS.path}`}
            className="admin-sidebar-icon-btn"
            title={PHOTOS.label}
          >
            {PHOTOS.icon}
          </Link>
        </div>

        {expandedGroup && (
          <>
            <div className="admin-sidebar-backdrop" onClick={() => setExpandedGroupId(null)} />
            <div className="admin-sidebar-flyout">
              <button
                className="admin-sidebar-close"
                onClick={() => setExpandedGroupId(null)}
                title="Close"
              >
                ✕
              </button>
              <div className="admin-sidebar-flyout-group-label">{expandedGroup.label}</div>
              {expandedGroup.items.map((s) => (
                <NavLink
                  key={s.path}
                  to={`/admin/${s.path}`}
                  className={({ isActive }) =>
                    "admin-sidebar-flyout-item" + (isActive ? " admin-sidebar-flyout-item-active" : "")
                  }
                  onClick={() => setExpandedGroupId(null)}
                >
                  <span className="admin-sidebar-flyout-icon">{s.icon}</span>
                  <span className="admin-sidebar-flyout-label">{s.label}</span>
                </NavLink>
              ))}
            </div>
          </>
        )}

        <div className="admin-layout-content">
          <Outlet context={nodesState} />
        </div>
      </div>
    </div>
  );
}
