import { useEffect, useState, useCallback } from "react";
import { apiGet, apiPatch, apiDelete } from "../utils/apiClient";

// Rewritten to call Users_API instead of Firestore + a Cloud Function.
// Same public interface (users, updateUserRole, deleteUserAccount) —
// UserPanelPage.jsx needs no changes.
//
// `uid` is used as the field name here (aliasing the backend's `id`),
// matching Firebase Auth's own naming — UserPanelPage.jsx references
// u.uid in several places (list keys, the delete/role-change calls, and
// critically the isSelf check comparing against currentUser?.uid from
// AuthContext, which needed its own matching fix for this comparison to
// actually work at all — see that file's own withUid comment).
//
// No live subscription anymore — confirmed early in this migration that
// reload-to-see-updates is fine — fetches once and refreshes after
// every mutation instead. deleteUserAccount no longer needs a separate
// Cloud Function for Admin SDK privileges either: that existed purely
// because the client SDK couldn't delete another user's Firebase Auth
// record directly. A plain authenticated DELETE request, checked by
// requireAdmin() same as everything else, replaces that entirely.

function toFrontendUser(row) {
  return {
    uid: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function useUsers() {
  const [users, setUsers] = useState([]);

  const refresh = useCallback(async () => {
    const data = await apiGet("Users_API/getAll");
    setUsers(data.users.map(toFrontendUser));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateUserRole = useCallback(
    async (uid, role) => {
      await apiPatch(`Users_API/updateRole/${uid}`, { role });
      await refresh();
    },
    [refresh]
  );

  const deleteUserAccount = useCallback(
    async (uid) => {
      await apiDelete(`Users_API/delete/${uid}`);
      await refresh();
    },
    [refresh]
  );

  return { users, updateUserRole, deleteUserAccount };
}
