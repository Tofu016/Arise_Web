import { useCallback } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "../utils/apiClient";
import { toAdmin } from "../utils/entities";
import { useCollection } from "./useCollection";

// Admins_API hook: the admin accounts shown in the User Panel (approved and
// pending), and the verbs that manage them.

async function loadAll() {
  const data = await apiGet("Admins_API/getAll");
  return data.admins.map(toAdmin);
}

export function useAdmins() {
  const { items: admins, loading, error, mutate } = useCollection(loadAll);

  const createAdmin = useCallback(
    (data) =>
      mutate(() => apiPost("Admins_API/create", data), {
        success: `Account created for "${data.email}".`,
        errorPrefix: "Couldn't create account",
      }),
    [mutate]
  );

  const approveAdmin = useCallback(
    (id) =>
      mutate(() => apiPatch(`Admins_API/approve/${id}`, {}), {
        success: "Account approved. They were notified by email.",
        errorPrefix: "Couldn't approve account",
      }),
    [mutate]
  );

  const deleteAdmin = useCallback(
    (id) =>
      mutate(() => apiDelete(`Admins_API/delete/${id}`), {
        success: "Account deleted.",
        errorPrefix: "Couldn't delete account",
      }),
    [mutate]
  );

  return { admins, loading, error, createAdmin, approveAdmin, deleteAdmin };
}
