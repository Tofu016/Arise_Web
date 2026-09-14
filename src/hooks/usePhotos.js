import { useEffect, useState, useCallback } from "react";
import { apiGet } from "../utils/apiClient";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost/Arise_API/index.php";

function getToken() {
  return localStorage.getItem("authToken");
}

// Mirrors useFeedback.js's own pattern for getAll — but deleteFile uses
// a direct fetch() rather than apiClient.js's apiDelete(), since that
// helper has only ever been used with an ID as a URL segment throughout
// this project, never a JSON body, and a photo's path genuinely
// contains slashes — it can't safely be a URL segment at all (same
// reasoning as why IndoorUploads_API's own serve() endpoint uses a
// query param instead). Rather than guess at apiDelete()'s exact
// behavior, this builds its own request directly.
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
      const headers = { "Content-Type": "application/json" };
      const token = getToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch(`${API_BASE_URL}/Photos_API/delete`, {
        method: "DELETE",
        headers,
        body: JSON.stringify({ path }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Couldn't delete this photo.");
      }
      await refresh();
    },
    [refresh]
  );

  return { photos, loading, deletePhoto };
}
