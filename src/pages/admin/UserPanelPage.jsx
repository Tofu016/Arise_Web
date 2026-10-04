import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/useAuth";
import { useUsers } from "../../hooks/useUsers";
import { fuzzyIncludes } from "../../utils/fuzzy";
import CreateUserDialog from "../../components/admin/CreateUserDialog";
import IconPlaceholder from "../../components/IconPlaceholder";

const ROLES = ["pending", "user", "admin"];
const ROLE_LABELS = { pending: "Pending", user: "User", admin: "Admin" };

function formatJoined(createdAt) {
  if (!createdAt) return "N/A";
  // The API sends a plain date string; the toDate() branch is a leftover from
  // the Firestore Timestamp the old backend produced.
  const date = typeof createdAt.toDate === "function" ? createdAt.toDate() : new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString();
}

// Inline <svg>, not an <img>, so the caret picks up the button's own
// currentColor (muted when enabled, faded with it when disabled); an SVG
// loaded through <img> renders in its own document and ignores currentColor.
function Caret() {
  return (
    <svg className="role-select-caret" width="10" height="6" viewBox="0 0 10 6" aria-hidden="true">
      <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
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
        aria-label={`Role: ${ROLE_LABELS[value] || value}`}
      >
        {ROLE_LABELS[value] || value} <Caret />
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
              {ROLE_LABELS[r]}
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
// globally would just mean every page pays for a users fetch only this
// one page actually uses.
//
// Layout: the page's one primary action (New Account) sits in the header
// row opposite the title, the same place a reader looks for it on any
// list page, rather than trailing the filters where it read as part of
// the search controls. The role filter is a row of count-bearing chips
// instead of a <select>: four fixed options fit on one line, the counts
// answer "how many are waiting on me?" without opening anything, and it
// sidesteps `.admin-layout select`'s width: 100% that had stretched the
// old dropdown across the row and crushed the search box to nothing.
export default function UserPanelPage() {
  const { user: currentUser } = useAuth();
  const { users, loading, createUser, updateUserRole, deleteUserAccount } = useUsers();
  const [deletingUid, setDeletingUid] = useState(null);
  const [approvingUid, setApprovingUid] = useState(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);

  // Pending accounts first (the ones needing action), then alphabetical by email.
  const sorted = useMemo(
    () =>
      [...users].sort((a, b) => {
        if (a.role === "pending" && b.role !== "pending") return -1;
        if (b.role === "pending" && a.role !== "pending") return 1;
        return (a.email || "").localeCompare(b.email || "");
      }),
    [users]
  );

  const roleCounts = useMemo(() => {
    const counts = { all: users.length, pending: 0, user: 0, admin: 0 };
    for (const u of users) counts[u.role || "pending"] = (counts[u.role || "pending"] || 0) + 1;
    return counts;
  }, [users]);

  const visible = useMemo(() => {
    return sorted.filter((u) => {
      if (roleFilter !== "all" && (u.role || "pending") !== roleFilter) return false;
      return fuzzyIncludes(search, [u.email, u.name]);
    });
  }, [sorted, search, roleFilter]);

  // Approves to "user", not "admin": the backend's own notion of an
  // approved account is user-or-admin, and handing out full editor access
  // should stay a deliberate second step through the role menu.
  const handleApprove = async (u) => {
    setApprovingUid(u.uid);
    try {
      await updateUserRole(u.uid, "user");
    } catch {
      // updateUserRole's own mutate() already reports this via toast.
    } finally {
      setApprovingUid(null);
    }
  };

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

  const filterChips = [{ id: "all", label: "All" }, ...ROLES.map((r) => ({ id: r, label: ROLE_LABELS[r] }))];

  return (
    <div className="user-panel-page">
      <div className="user-panel-header">
        <div className="user-panel-title">
          <h2 className="admin-page-heading">User Panel</h2>
          <p className="user-panel-subtitle">
            Approve new sign-ups, change roles, and create or remove admin accounts.
          </p>
        </div>
        <button type="button" className="primary user-panel-create-btn" onClick={() => setShowCreate(true)}>
          + New Account
        </button>
      </div>

      <div className="user-panel-toolbar">
        <div className="user-panel-search">
          <IconPlaceholder name="search-magnifier" className="user-panel-search-icon" />
          <input
            type="search"
            className="user-panel-search-input"
            placeholder="Search by name or email"
            aria-label="Search accounts by name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="user-panel-filters" role="group" aria-label="Filter by role">
          {filterChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className={
                "user-panel-filter-chip" +
                (roleFilter === chip.id ? " user-panel-filter-chip-active" : "") +
                (chip.id === "pending" && roleCounts.pending > 0 ? " user-panel-filter-chip-alert" : "")
              }
              aria-pressed={roleFilter === chip.id}
              onClick={() => setRoleFilter(chip.id)}
            >
              {chip.label}
              <span className="user-panel-filter-count">{roleCounts[chip.id] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      {showCreate && (
        <CreateUserDialog createUser={createUser} onClose={() => setShowCreate(false)} />
      )}

      {loading && users.length === 0 && <p className="empty-hint">Loading accounts...</p>}
      {!loading && sorted.length === 0 && <p className="empty-hint">No registered users yet.</p>}
      {sorted.length > 0 && visible.length === 0 && (
        <p className="empty-hint">No accounts match this search or role filter.</p>
      )}

      <div className="users-list">
        {visible.map((u) => {
          const isSelf = u.uid === currentUser?.uid;
          const isDeleting = deletingUid === u.uid;
          const isApproving = approvingUid === u.uid;
          const isBusy = isDeleting || isApproving;
          const role = u.role || "pending";
          return (
            <div key={u.uid} className={"users-row user-panel-row" + (role === "pending" ? " users-row-pending" : "")}>
              <div className="users-row-main">
                <div className="user-panel-row-name">
                  <span>{u.name || u.email}</span>
                  {isSelf && <span className="user-panel-tag">You</span>}
                  {role === "pending" && (
                    <span className="user-panel-tag user-panel-tag-pending">Awaiting approval</span>
                  )}
                </div>
                {u.name && <span className="users-row-email">{u.email}</span>}
              </div>
              <span className="user-panel-row-joined">Joined {formatJoined(u.createdAt)}</span>
              <div className="users-row-actions">
                {role === "pending" && (
                  <button
                    type="button"
                    className="user-panel-approve-btn"
                    onClick={() => handleApprove(u)}
                    disabled={isBusy}
                    title="Approve as User. Use the role menu to make them an Admin."
                  >
                    {isApproving ? "Approving…" : "Approve"}
                  </button>
                )}
                <RoleSelect
                  value={role}
                  onChange={(r) => updateUserRole(u.uid, r)}
                  disabled={isSelf || isBusy}
                  title={isSelf ? "You can't change your own role here. Ask another admin." : undefined}
                />
                <button
                  type="button"
                  className="danger users-row-delete"
                  onClick={() => handleDelete(u)}
                  disabled={isSelf || isBusy}
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
