import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/useAuth";
import { useUsers } from "../../hooks/useUsers";
import { fuzzyIncludes } from "../../utils/fuzzy";

const ROLES = ["pending", "user", "admin"];

function formatJoined(createdAt) {
  if (!createdAt) return "N/A";
  // Firestore Timestamp (has .toDate()) vs. a plain ISO string, just in case.
  const date = typeof createdAt.toDate === "function" ? createdAt.toDate() : new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString();
}

// A fully custom dropdown, not a native <select> — some browsers (notably
// Safari) don't fully honor `appearance: none` on selects, so no matter how
// it's styled the native control can still render with its own rounded
// "pill" chrome that never quite matches a plain <button> next to it. This
// is real button + a small menu instead, guaranteeing byte-identical
// styling to the Delete button beside it on every browser.
function RoleSelect({ value, onChange, disabled, title }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [open]);

  return (
    <div className="role-select" ref={wrapperRef}>
      <button
        type="button"
        className="role-select-btn"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        title={title}
      >
        {value} <span className="role-select-caret">▾</span>
      </button>
      {open && (
        <div className="role-select-menu">
          {ROLES.map((r) => (
            <div
              key={r}
              className={"role-select-option" + (r === value ? " role-select-option-active" : "")}
              onClick={() => {
                onChange(r);
                setOpen(false);
              }}
            >
              {r}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Promoted from the old UsersPanel modal to a full page — the simplest
// of the four migrations. Calls useUsers() directly here rather than
// adding it to AdminLayout's shared Outlet context — unlike nodes/
// selectedNodeId, no other section needs user data, so sharing it
// globally would just mean every page pays for a Firestore subscription
// only this one page actually uses.
//
// No wireframe reference exists for this page's own content (only the
// sidebar label) — layout below follows the same general conventions as
// the other three pages rather than matching a specific mockup.
export default function UserPanelPage() {
  const { user: currentUser } = useAuth();
  const { users, updateUserRole, deleteUserAccount } = useUsers();
  const [deletingUid, setDeletingUid] = useState(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  // Pending accounts first (the ones needing action), then alphabetical by email.
  const sorted = [...users].sort((a, b) => {
    if (a.role === "pending" && b.role !== "pending") return -1;
    if (b.role === "pending" && a.role !== "pending") return 1;
    return (a.email || "").localeCompare(b.email || "");
  });

  const visible = useMemo(() => {
    return sorted.filter((u) => {
      if (roleFilter !== "all" && (u.role || "pending") !== roleFilter) return false;
      return fuzzyIncludes(search, [u.email, u.name]);
    });
  }, [sorted, search, roleFilter]);

  const pendingCount = users.filter((u) => u.role === "pending").length;

  const handleDelete = async (u) => {
    if (!confirm(`Permanently delete ${u.email}? This removes their login and profile; they'd have to register again from scratch. This can't be undone.`)) {
      return;
    }
    setDeletingUid(u.uid);
    try {
      await deleteUserAccount(u.uid);
    } catch {
      // deleteUserAccount's own mutate() already reports this via toast.
    } finally {
      setDeletingUid(null);
    }
  };

  return (
    <div className="user-panel-page">
      <h2 className="admin-page-heading">
        User Panel
        {pendingCount > 0 && <span className="badge-count">{pendingCount} pending</span>}
      </h2>

      <div className="users-filter-row">
        <input
          type="text"
          className="users-search-input"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="users-role-filter"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="all">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {sorted.length === 0 && <p className="empty-hint">No registered users yet.</p>}
      {sorted.length > 0 && visible.length === 0 && (
        <p className="empty-hint">No users match this search/filter.</p>
      )}

      <div className="users-list">
        {visible.map((u) => {
          const isSelf = u.uid === currentUser?.uid;
          const isDeleting = deletingUid === u.uid;
          return (
            <div key={u.uid} className={"users-row" + (u.role === "pending" ? " users-row-pending" : "")}>
              <div className="users-row-main">
                <span className="users-row-email">{u.email}</span>
                {u.name && <span className="users-row-name">{u.name}</span>}
                <span className="field-hint">Joined {formatJoined(u.createdAt)}</span>
              </div>
              <div className="users-row-actions">
                <RoleSelect
                  value={u.role || "pending"}
                  onChange={(r) => updateUserRole(u.uid, r)}
                  disabled={isSelf || isDeleting}
                  title={isSelf ? "You can't change your own role here. Ask another admin." : undefined}
                />
                <button
                  type="button"
                  className="danger users-row-delete"
                  onClick={() => handleDelete(u)}
                  disabled={isSelf || isDeleting}
                  title={isSelf ? "You can't delete your own account here. Ask another admin." : undefined}
                >
                  {isDeleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
