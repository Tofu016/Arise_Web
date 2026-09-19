import { useCallback } from "react";
import { apiGet, apiDelete } from "../utils/apiClient";
import { useCollection } from "./useCollection";

async function loadAll() {
  const data = await apiGet("Photos_API/getAll");
  return data.photos;
}

// deletePhoto sends the path as a JSON body rather than a URL segment,
// since a photo's path genuinely contains slashes (same reasoning as why
// IndoorUploads_API's own serve() endpoint uses a query param instead).
export function usePhotos() {
  const { items: photos, loading, error, mutate } = useCollection(loadAll);

  const deletePhoto = useCallback(
    (path) => mutate(() => apiDelete("Photos_API/delete", { path }, "Couldn't delete this photo.")),
    [mutate]
  );

  return { photos, loading, error, deletePhoto };
}
