import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useNodes } from "../hooks/useNodes";
import { useElevators } from "../hooks/useElevators";
import { useAuth } from "../context/useAuth";
import accountIcon from "../assets/icons/account.svg";
import locationIcon from "../assets/icons/location.svg";
import IconPlaceholder from "../components/IconPlaceholder";

const ACCOUNT_ICON = <img src={accountIcon} alt="" className="admin-sidebar-icon-img" />;
const LOCATION_ICON = <img src={locationIcon} alt="" className="admin-sidebar-icon-img" />;
// Pending real icons — see the icon list handed back to the user.
const PLACEHOLDER = (name) => <IconPlaceholder name={name} className="admin-sidebar-icon-img" />;

// Top-level groups, per the confirmed sidebar architecture — Virtual Map
// collapses to one rail icon and expands into its own labeled sub-items;
// User Panel is its own single rail icon with no sub-items or grouping at
// all, since user management genuinely doesn't belong to any one group.
//
// Group-level icons deliberately avoid reusing any of their own
// sub-items' icons (Virtual Map's own "Navigation Editor"
// already uses 🗺️, for instance) so the rail and the expanded flyout
// never show the same icon meaning two different things at two different
// levels.
const GROUPS = [
  {
    id: "indoor",
    icon: PLACEHOLDER("building"),
    label: "Virtual Map",
    items: [
      { path: "node-editor", icon: PLACEHOLDER("home-house"), label: "Node Editor" },
      { path: "node-flowchart", icon: PLACEHOLDER("workflow"), label: "Node Flowchart" },
      { path: "navigation-editor", icon: PLACEHOLDER("route"), label: "Navigation Editor" },
      { path: "room-and-facility-editor", icon: PLACEHOLDER("door"), label: "Room and Facility Editor" },
      { path: "marker-management", icon: LOCATION_ICON, label: "Marker Management" },
      { path: "emergency-coverage", icon: PLACEHOLDER("emergency-exit"), label: "Emergency Coverage" },
    ],
  },
];

// Standalone rail icons — each a direct link with no sub-items, so
// (unlike GROUPS) clicking navigates immediately with no flyout step.
// User Panel: user management doesn't belong to any one editor group.
// Analytics: session/behavior tracking plus feedback comments (formerly
// the plain Feedback page), same reasoning. Uses the bar-chart icon
// (formerly Photo Coverage's) now that Photo Coverage itself uses the
// picture-frame icon below.
// Photo Coverage: covers every photo type (the former standalone Photos
// page was merged into it), so it uses that page's own picture-frame icon.
const USER_PANEL = { path: "user-panel", icon: ACCOUNT_ICON, label: "User Panel" };
const ANALYTICS = { path: "analytics", icon: PLACEHOLDER("bar-chart"), label: "Analytics" };
const PHOTO_COVERAGE = { path: "photo-coverage", icon: PLACEHOLDER("picture-frame"), label: "Photo Coverage" };
// Advertisements: the kiosk's bottom-band media (signage). Kiosk-wide, not
// part of the Virtual Map's own content, so it stands alone too.
const ADVERTISEMENTS = { path: "advertisements", icon: PLACEHOLDER("megaphone"), label: "Advertisements" };
// Kiosks: the physical kiosk devices and where each stands on the map.
// Kiosk-wide like Advertisements, so it stands alone too.
const KIOSKS = { path: "kiosks", icon: PLACEHOLDER("kiosk"), label: "Kiosks" };
const STANDALONE_ITEMS = [USER_PANEL, ANALYTICS, PHOTO_COVERAGE, ADVERTISEMENTS, KIOSKS];

// Shared shell for every admin section — header, collapsible sidebar, and
// the actual page content via <Outlet>. useNodes() is called ONCE here,
// not independently per page, and passed down through Outlet's own
// context — this is what lets a node selected in one Virtual Map section
// still be the selected node after switching to another, rather than
// every page losing track of it on navigation.
//
// Sidebar interaction: collapsed is an icon-only rail, always visible.
// Clicking a GROUP icon expands into a flyout showing that group's own
// name as a header, followed by its labeled sub-items — picking one of
// those is what actually navigates and collapses the flyout back. User
// Panel's rail icon is a plain, direct link instead — it has no
// sub-items to show, so forcing an extra "expand, then pick the one and
// only option" step would just be a needless click with no benefit.
export default function AdminLayout() {
  const { user, signOut } = useAuth();
  const { pathname } = useLocation();
  const nodesState = useNodes();
  // Elevators are their own small collection (see useElevators.js) rather
  // than folded into a node's own patch — one elevators row can be pointed
  // at by landing markers on several different nodes at once. `loading` is
  // renamed to avoid colliding with nodesState's own `loading` in the
  // merged context below.
  const { loading: elevatorsLoading, ...elevatorsState } = useElevators();
  // Which group's flyout is open, if any — null, or a GROUPS[].id.
  const [expandedGroupId, setExpandedGroupId] = useState(null);
  const expandedGroup = GROUPS.find((g) => g.id === expandedGroupId) || null;
  // Whether the currently viewed admin page is at this sub-path — drives
  // the active highlight on both a standalone rail icon and (via .some()
  // over its items) a group's own rail icon, since a group's icon has no
  // route of its own to match directly.
  const isActivePath = (path) => pathname === `/admin/${path}` || pathname.startsWith(`/admin/${path}/`);

  const displayName = user?.name || user?.email || "";

  return (
    <div className="admin-layout">
      <div className="admin-header">
        <div className="admin-header-side admin-header-nav">
          <Link to="/" className="admin-header-nav-btn primary">Back to Virtual Map</Link>
        </div>
        <div className="admin-header-center">
          <div className="admin-header-title-line" />
          <span className="admin-header-title">Admin Editor</span>
        </div>
        <div className="admin-header-side admin-header-account">
          <div className="admin-account-badge">Admin</div>
          <span className="account-name" title={displayName}>{displayName}</span>
          <button onClick={signOut} className="admin-btn-secondary">Sign out</button>
        </div>
      </div>

      <div className="admin-layout-body">
        <div className="admin-sidebar-rail">
          {/* Each icon sits in its own positioning wrapper so its hover
              preview (name, and a group's own sub-items) can be absolutely
              positioned off the icon without the rail's own flex layout
              interfering — see .admin-sidebar-icon-preview. */}
          {GROUPS.map((g) => {
            const active = g.items.some((s) => isActivePath(s.path));
            return (
              <div key={g.id} className="admin-sidebar-rail-item">
                <button
                  className={"admin-sidebar-icon-btn" + (active ? " admin-sidebar-icon-btn-active" : "")}
                  onClick={() => setExpandedGroupId(g.id)}
                  aria-label={g.label}
                >
                  {g.icon}
                </button>
                <div className="admin-sidebar-icon-preview" role="tooltip">
                  <div className="admin-sidebar-icon-preview-title">{g.label}</div>
                  <ul className="admin-sidebar-icon-preview-list">
                    {g.items.map((s) => (
                      <li key={s.path}>
                        <span>{s.icon}</span>
                        <span>{s.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
          {STANDALONE_ITEMS.map((entry) => (
            <div key={entry.path} className="admin-sidebar-rail-item">
              <Link
                to={`/admin/${entry.path}`}
                className={"admin-sidebar-icon-btn" + (isActivePath(entry.path) ? " admin-sidebar-icon-btn-active" : "")}
                aria-label={entry.label}
              >
                {entry.icon}
              </Link>
              {/* No sub-item list — a standalone entry's "contents" is
                  just itself, so the preview is name-only. */}
              <div className="admin-sidebar-icon-preview" role="tooltip">
                <div className="admin-sidebar-icon-preview-title">{entry.label}</div>
              </div>
            </div>
          ))}
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
          <Outlet context={{ ...nodesState, ...elevatorsState, elevatorsLoading }} />
        </div>
      </div>
    </div>
  );
}
