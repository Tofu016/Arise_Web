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
    (item) => mutate(() => apiPost("TourSections_API/create", sectionCreateBody(item))),
    [mutate]
  );

  const updateSection = useCallback(
    (id, patch) =>
      mutate(async () => {
        const body = sectionPatchBody(patch);
        if (Object.keys(body).length > 0) {
          await apiPatch(`TourSections_API/update/${id}`, body);
        }
      }),
    [mutate]
  );

  const deleteSection = useCallback(
    (id) => mutate(() => apiDelete(`TourSections_API/delete/${id}`)),
    [mutate]
  );

  return { sections, loading, addSection, updateSection, deleteSection };
}
