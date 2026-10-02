import { useCallback } from "react";
import { apiGet, apiPost, apiPatch } from "../utils/apiClient";
import { toDialog, normalizeRoomName, dialogPatchBody, dialogCreateBody } from "../utils/entities";
import { useCollection } from "./useCollection";

// PlacardDialogs_API hook. Minimal public interface (getForRoom,
// saveRoomDialog) — the raw list itself is never exposed. Wire mapping
// lives in utils/entities.js.
//
// saveRoomDialog's upsert-by-name semantics (update if a room with this
// name exists, create with defaults if not) is genuinely different from
// how PlacardDialogs_API was built (separate create/update endpoints,
// create() REJECTS a duplicate name outright) — this hook is what bridges
// that gap: it looks the existing record up itself first, then calls
// whichever endpoint actually applies.

async function loadAll() {
  const data = await apiGet("PlacardDialogs_API/getAll");
  return data.dialogs.map(toDialog);
}

export function usePlacardDialogs() {
  const { items, refresh, itemsRef: docsRef } = useCollection(loadAll);

  // Depends on `items` (read through the ref) so its identity changes when
  // the list loads or refreshes. Callers memoize room lists on getForRoom
  // (MainPage's searchableRooms); with a stable identity they kept the
  // placard-less list built before this fetch landed, so rooms opened with
  // no link, contact number, description, or photo.
  const getForRoom = useCallback(
    (roomName) => {
      const key = normalizeRoomName(roomName);
      if (!key) return null;
      return docsRef.current.find((d) => normalizeRoomName(d.roomName) === key) || null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [docsRef, items]
  );

  // roomName is the CURRENT/old name to look up by — when renaming,
  // patch.roomName carries the new one. Looking up by the old name but
  // writing the new one is exactly what turns this into a rename rather
  // than a create.
  const saveRoomDialog = useCallback(
    async (roomName, patch) => {
      const existing = getForRoom(roomName);

      let id;
      if (existing) {
        await apiPatch(`PlacardDialogs_API/update/${existing.id}`, dialogPatchBody(patch));
        id = existing.id;
      } else {
        const data = await apiPost("PlacardDialogs_API/create", dialogCreateBody(roomName, patch));
        id = data.dialog.id;
      }

      await refresh();
      return id;
    },
    [getForRoom, refresh]
  );

  return { getForRoom, saveRoomDialog };
}
