import { useMemo, useState } from "react";
import { useAuth } from "../../context/useAuth";
import { useAdmins } from "../../hooks/useAdmins";
import { fuzzyIncludes } from "../../utils/fuzzy";
import CreateAdminDialog from "../../components/admin/CreateAdminDialog";
import IconPlaceholder from "../../components/IconPlaceholder";
import { useConfirm } from "../../context/useConfirm";

function formatJoined(createdAt) {
  if (!createdAt) return "N/A";
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString();
}

// Lists the admin accounts, the only accounts that exist. Calls useAdmins()
// directly here rather than adding it to AdminLayout's shared Outlet
// context: unlike nodes/selectedNodeId, no other section needs this data,
// so sharing it globally would just make every page pay for a fetch only
// this one uses.
//
// Layout: the page's one primary action (New Account) sits in the header
// row opposite the title, the same place a reader looks for it on any
// list page.
export default function UserPanelPage() {
  const { confirm } = useConfirm();
  const { user: currentUser } = useAuth();
  const { admins, loading, createAdmin, approveAdmin, deleteAdmin } = useAdmins();
  const [deletingUid, setDeletingUid] = useState(null);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [approvingUid, setApprovingUid] = useState(null);

  const sorted = useMemo(
    () => [...admins].sort((a, b) => (a.email || "").localeCompare(b.email || "")),
    [admins]
  );

  const visible = useMemo(
    () => sorted.filter((a) => fuzzyIncludes(search, [a.email, a.name])),
    [sorted, search]
  );

  const handleApprove = async (a) => {
    setApprovingUid(a.uid);
    try {
      await approveAdmin(a.uid);
    } catch {
      // approveAdmin's own mutate() already reports this via toast.
    } finally {
      setApprovingUid(null);
    }
  };

  const handleDelete = async (a) => {
    const pending = a.status === "pending";
    const ok = await confirm({
      title: pending ? "Reject request?" : "Delete account?",
      message: pending
        ? `Reject and delete the pending request from ${a.email}? This can't be undone.`
        : `Permanently delete ${a.email}? They will no longer be able to sign in. This can't be undone.`,
      confirmLabel: pending ? "Reject" : "Delete",
      danger: true,
    });
    if (!ok) return;
    setDeletingUid(a.uid);
    try {
      await deleteAdmin(a.uid);
    } catch {
      // deleteAdmin's own mutate() already reports this via toast.
    } finally {
      setDeletingUid(null);
    }
  };

  return (
    <div className="user-panel-page">
      <div className="user-panel-header">
        <div className="user-panel-title">
          <h2 className="admin-page-heading">User Panel</h2>
          <p className="user-panel-subtitle">
            Create and remove the admin accounts that can sign in, and approve the accounts that registered themselves. An admin who forgot their password resets it by email from the sign-in page.
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
      </div>

      {showCreate && (
        <CreateAdminDialog createAdmin={createAdmin} onClose={() => setShowCreate(false)} />
      )}

      {loading && admins.length === 0 && <p className="empty-hint">Loading accounts...</p>}
      {sorted.length > 0 && visible.length === 0 && (
        <p className="empty-hint">No accounts match this search.</p>
      )}

      <div className="users-list">
        {visible.map((a) => {
          const isSelf = a.uid === currentUser?.id;
          const isDeleting = deletingUid === a.uid;
          const isPending = a.status === "pending";
          const isApproving = approvingUid === a.uid;
          return (
            <div key={a.uid} className="users-row user-panel-row">
              <div className="users-row-main">
                <div className="user-panel-row-name">
                  <span>{a.name || a.email}</span>
                  {isSelf && <span className="user-panel-tag">You</span>}
                  {isPending && <span className="user-panel-tag">Pending</span>}
                </div>
                {a.name && <span className="users-row-email">{a.email}</span>}
              </div>
              <span className="user-panel-row-joined">Joined {formatJoined(a.createdAt)}</span>
              <div className="users-row-actions">
                {isPending && (
                  <button type="button" className="admin-btn-secondary" onClick={() => handleApprove(a)} disabled={isApproving || isDeleting}>
                    {isApproving ? "Approving…" : "Approve"}
                  </button>
                )}
                <button
                  type="button"
                  className="danger users-row-delete"
                  onClick={() => handleDelete(a)}
                  disabled={isSelf || isDeleting}
                  title={isSelf ? "You can't delete your own account here. Ask another admin." : undefined}
                >
                  {isDeleting ? "Deleting…" : isPending ? "Reject" : "Delete"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
