import { useEffect, useState, useCallback, useRef } from "react";
import { apiGet, apiPost, apiPatch } from "../utils/apiClient";

// Rewritten to call PlacardDialogs_API instead of Firestore. Same
// minimal public interface (getForRoom, saveRoomDialog) — the raw list
// itself was never exposed before either, so that stays true here too.
//
// Field names translate between the backend's snake_case (photo_path,
// photo_360_path, description, search_terms as a real child table) and
// what this hook has always returned (photo, photo360, roomDescription,
// ocrSearchTerms as a plain array of strings) — same reasoning as every
// other rewritten hook: keep RoomEditorPage.jsx completely unchanged.
//
// saveRoomDialog's upsert-by-name semantics (update if a room with this
// name exists, create with defaults if not) is genuinely different from
// how PlacardDialogs_API was originally built (separate create/update
// endpoints, create() REJECTS a duplicate name outright) — this hook is
// what bridges that gap: it looks the existing record up itself first,
// then calls whichever endpoint actually applies.

function normalize(name) {
  return (name || "").trim().toUpperCase();
}

function toFrontendDialog(row) {
  return {
    id: row.id,
    roomName: row.room_name,
    roomDescription: row.description || "",
    department: row.department || "",
    use: row.use || "",
    link: row.link || "",
    photo: row.photo_path || "",
    photo360: row.photo_360_path || "",
    ocrSearchTerms: (row.search_terms || []).map((t) => t.term),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function usePlacardDialogs() {
  const [docs, setDocs] = useState([]);
  const docsRef = useRef([]);
  useEffect(() => {
    docsRef.current = docs;
  }, [docs]);

  const refresh = useCallback(async () => {
    const data = await apiGet("PlacardDialogs_API/getAll");
    setDocs(data.dialogs.map(toFrontendDialog));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const getForRoom = useCallback((roomName) => {
    const key = normalize(roomName);
    if (!key) return null;
    return docsRef.current.find((d) => normalize(d.roomName) === key) || null;
  }, []);

  // roomName is the CURRENT/old name to look up by — when renaming,
  // patch.roomName carries the new one. Looking up by the old name but
  // writing the new one is exactly what turns this into a rename rather
  // than a create, matching the original Firestore version's own
  // behavior (same document, patched in place, never a new one).
  const saveRoomDialog = useCallback(
    async (roomName, patch) => {
      const existing = getForRoom(roomName);

      const body = {};
      if (patch.roomName !== undefined) body.room_name = patch.roomName;
      if (patch.roomDescription !== undefined) body.description = patch.roomDescription;
      if (patch.department !== undefined) body.department = patch.department;
      if (patch.use !== undefined) body.use = patch.use;
      if (patch.link !== undefined) body.link = patch.link;
      if (patch.photo !== undefined) body.photo_path = patch.photo;
      if (patch.photo360 !== undefined) body.photo_360_path = patch.photo360;
      if (patch.ocrSearchTerms !== undefined) body.search_terms = patch.ocrSearchTerms;

      let id;
      if (existing) {
        await apiPatch(`PlacardDialogs_API/update/${existing.id}`, body);
        id = existing.id;
      } else {
        // Same defaults the original hook seeded a brand-new record
        // with — an empty description and one OCR term derived from
        // the room name — before applying whatever the actual patch
        // provides on top.
        const trimmedName = (patch.roomName || roomName).trim();
        const ocrTerm = trimmedName.toLowerCase().replace(/[^a-z0-9]/g, "");
        const data = await apiPost("PlacardDialogs_API/create", {
          room_name: trimmedName,
          description: "",
          search_terms: ocrTerm ? [ocrTerm] : [],
          ...body,
        });
        id = data.dialog.id;
      }

      await refresh();
      return id;
    },
    [getForRoom, refresh]
  );

  return { getForRoom, saveRoomDialog };
}
