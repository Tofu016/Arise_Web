import { useCallback } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "../utils/apiClient";
import { useCollection } from "./useCollection";

// Kiosks_API admin hooks: the registered kiosks, and the verbs that manage
// them. A pairing code is only ever returned by create/resetPairing, so
// those two resolve with it for the page to show once.

const EMPTY = { kiosks: [], serverTime: null, readAt: 0 };

// MySQL booleans arrive as "0"/"1" strings.
const flag = (v) => v === "1" || v === 1 || v === true;

const toKiosk = (row) => ({
  id: row.id,
  name: row.name,
  nodeId: row.node_id,
  nodeName: row.node_name,
  paired: flag(row.paired),
  codePending: flag(row.code_pending),
  codeExpiresAt: row.pairing_expires_at,
  pairedAt: row.paired_at,
  lastSeenAt: row.last_seen_at,
});

async function loadAll() {
  const data = await apiGet("Kiosks_API/getAll");
  return { kiosks: data.kiosks.map(toKiosk), serverTime: data.server_time, readAt: Date.now() };
}

export function useKiosks() {
  const { items: state, loading, error, mutate } = useCollection(loadAll, EMPTY);

  // Resolves with the one-time pairing code.
  const createKiosk = useCallback(
    async ({ name, nodeId }) => {
      let code = null;
      await mutate(
        async () => {
          const res = await apiPost("Kiosks_API/create", { name, node_id: nodeId || "" });
          code = res.pairing_code;
        },
        { success: `"${name}" added.`, errorPrefix: "Couldn't add the kiosk" }
      );
      return code;
    },
    [mutate]
  );

  const updateKiosk = useCallback(
    (kiosk, { name, nodeId }) =>
      mutate(() => apiPatch(`Kiosks_API/update/${kiosk.id}`, { name, node_id: nodeId || "" }), {
        success: `"${name}" saved.`,
        errorPrefix: "Couldn't save the kiosk",
      }),
    [mutate]
  );

  // Revokes the device's token and resolves with a fresh pairing code.
  const resetPairing = useCallback(
    async (kiosk) => {
      let code = null;
      await mutate(
        async () => {
          const res = await apiPost(`Kiosks_API/resetPairing/${kiosk.id}`, {});
          code = res.pairing_code;
        },
        { success: `"${kiosk.name}" unpaired. Use the new code to pair it again.`, errorPrefix: "Couldn't reset the pairing" }
      );
      return code;
    },
    [mutate]
  );

  const deleteKiosk = useCallback(
    (kiosk) =>
      mutate(() => apiDelete(`Kiosks_API/delete/${kiosk.id}`), {
        success: `"${kiosk.name}" deleted.`,
        errorPrefix: "Couldn't delete the kiosk",
      }),
    [mutate]
  );

  return {
    kiosks: state.kiosks,
    serverTime: state.serverTime,
    readAt: state.readAt,
    loading,
    error,
    createKiosk,
    updateKiosk,
    resetPairing,
    deleteKiosk,
  };
}
