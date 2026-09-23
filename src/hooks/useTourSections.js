import { useCallback } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "../utils/apiClient";
import { toSection, sectionCreateBody, sectionPatchBody } from "../utils/entities";
import { useCollection } from "./useCollection";

// TourSections_API hook. Public shape (sections, loading, addSection,
// updateSection, deleteSection); wire mapping lives in utils/entities.js.

async function loadAll() {
  const data = await apiGet("TourSections_API/getAll");
  return data.sections.map(toSection);
}

export function useTourSections() {
  const { items: sections, loading, mutate } = useCollection(loadAll);

  const addSection = useCallback(
    (item) =>
      mutate(() => apiPost("TourSections_API/create", sectionCreateBody(item)), {
        success: `Section "${item.label}" created.`,
        errorPrefix: "Couldn't create section",
      }),
    [mutate]
  );

  const updateSection = useCallback(
    (id, patch) =>
      mutate(
        async () => {
          const body = sectionPatchBody(patch);
          if (Object.keys(body).length > 0) {
            await apiPatch(`TourSections_API/update/${id}`, body);
          }
        },
        { success: "Section saved.", errorPrefix: "Couldn't save section" }
      ),
    [mutate]
  );

  const deleteSection = useCallback(
    (id) =>
      mutate(() => apiDelete(`TourSections_API/delete/${id}`), {
        success: "Section deleted.",
        errorPrefix: "Couldn't delete section",
      }),
    [mutate]
  );

  return { sections, loading, addSection, updateSection, deleteSection };
}
