import { useEffect, useState, useCallback } from "react";
import { apiGet, apiDelete } from "../utils/apiClient";

// Mirrors useFeedback.js's own pattern for getAll. deletePhoto sends the
// path as a JSON body rather than a URL segment, since a photo's path
// genuinely contains slashes (same reasoning as why IndoorUploads_API's
// own serve() endpoint uses a query param instead).
export function usePhotos() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet("Photos_API/getAll");
      setPhotos(data.photos);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const deletePhoto = useCallback(
    async (path) => {
      await apiDelete("Photos_API/delete", { path }, "Couldn't delete this photo.");
      await refresh();
    },
    [refresh]
  );

  return { photos, loading, deletePhoto };
}
