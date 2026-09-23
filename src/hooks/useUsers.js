import { useCallback } from "react";
import { apiGet, apiPatch, apiDelete } from "../utils/apiClient";
import { toUser } from "../utils/entities";
import { useCollection } from "./useCollection";

// Users_API hook. Public interface (users, loading, error, updateUserRole,
// deleteUserAccount). `uid` aliases the backend's `id` — see toUser in
// utils/entities.js.

async function loadAll() {
  const data = await apiGet("Users_API/getAll");
  return data.users.map(toUser);
}

export function useUsers() {
  const { items: users, loading, error, mutate } = useCollection(loadAll);

  const updateUserRole = useCallback(
    (uid, role) =>
      mutate(() => apiPatch(`Users_API/updateRole/${uid}`, { role }), {
        success: `Role updated to "${role}".`,
        errorPrefix: "Couldn't update role",
      }),
    [mutate]
  );

  const deleteUserAccount = useCallback(
    (uid) =>
      mutate(() => apiDelete(`Users_API/delete/${uid}`), {
        success: "Account deleted.",
        errorPrefix: "Couldn't delete account",
      }),
    [mutate]
  );

  return { users, loading, error, updateUserRole, deleteUserAccount };
}
