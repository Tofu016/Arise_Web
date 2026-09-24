import { useCallback } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "../utils/apiClient";
import { toElevator, elevatorCreateBody, elevatorPatchBody } from "../utils/entities";
import { useCollection } from "./useCollection";

// Elevators_API hook — the single source for an elevator's label, building
// and accessible floors (see utils/elevators.js): every landing marker
// just points at one of these by id, instead of carrying its own copy.
// Public shape (elevators, loading, addElevator, updateElevator,
// deleteElevator) mirrors useTourSections.js.

async function loadAll() {
  const data = await apiGet("Elevators_API/getAll");
  return data.elevators.map(toElevator);
}

export function useElevators() {
  const { items: elevators, loading, mutate } = useCollection(loadAll);

  const addElevator = useCallback(
    (item) =>
      mutate(() => apiPost("Elevators_API/create", elevatorCreateBody(item)), {
        success: `Elevator "${item.id}" created.`,
        errorPrefix: "Couldn't create elevator",
      }),
    [mutate]
  );

  const updateElevator = useCallback(
    (id, patch) =>
      mutate(
        async () => {
          const body = elevatorPatchBody(patch);
          if (Object.keys(body).length > 0) {
            await apiPatch(`Elevators_API/update/${id}`, body);
          }
        },
        { success: "Elevator saved.", errorPrefix: "Couldn't save elevator" }
      ),
    [mutate]
  );

  // Cascades to every landing marker of it (see schema's ON DELETE CASCADE)
  // — the caller doesn't need to remove those markers itself first.
  const deleteElevator = useCallback(
    (id) =>
      mutate(() => apiDelete(`Elevators_API/delete/${id}`), {
        success: "Elevator deleted.",
        errorPrefix: "Couldn't delete elevator",
      }),
    [mutate]
  );

  return { elevators, loading, addElevator, updateElevator, deleteElevator };
}
