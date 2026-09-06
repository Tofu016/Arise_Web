import { useState, useEffect, useCallback } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "../utils/apiClient";

// Rewritten to call TourSections_API instead of Firestore. The public
// shape returned by this hook (sections, loading, addSection,
// updateSection, deleteSection) is deliberately unchanged from the
// Firebase version — every component already using this hook
// (TourStopsPage.jsx, SectionEditorModal.jsx) needs zero changes of its
// own; only what happens inside this file is different.
//
// No live subscription anymore (Firestore's onSnapshot is gone) —
// confirmed early in the migration that reload-to-see-updates is fine,
// so this fetches once on mount and re-fetches after every mutation
// instead of listening continuously.
//
// Field names are translated between the backend's snake_case
// (matching the database directly) and the camelCase this hook has
// always returned — keeping every existing consumer of this hook
// working unchanged, rather than pushing that translation out onto
// every component that uses it.

function toCamelSection(row) {
  return {
    id: row.id,
    label: row.label,
    coverPhoto: row.cover_photo_path || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function useTourSections() {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await apiGet("TourSections_API/getAll");
      setSections(data.sections.map(toCamelSection));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addSection = useCallback(
    async ({ label, coverPhoto }) => {
      await apiPost("TourSections_API/create", {
        label,
        cover_photo_path: coverPhoto || undefined,
      });
      await refresh();
    },
    [refresh]
  );

  const updateSection = useCallback(
    async (id, patch) => {
      const body = {};
      if (patch.label !== undefined) body.label = patch.label;
      if (patch.coverPhoto !== undefined) body.cover_photo_path = patch.coverPhoto;

      await apiPatch(`TourSections_API/update/${id}`, body);
      await refresh();
    },
    [refresh]
  );

  const deleteSection = useCallback(
    async (id) => {
      await apiDelete(`TourSections_API/delete/${id}`);
      await refresh();
    },
    [refresh]
  );

  return { sections, loading, addSection, updateSection, deleteSection };
}
