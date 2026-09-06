import { useEffect, useState } from "react";
import { ref, getBytes } from "firebase/storage";
import { storage } from "../firebase";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost/Arise_API/index.php";
// Same three prefixes TourUploads_API saves under and
// tourPhotoSync.js's own upload functions use — genuinely public
// content, servable as a direct static file, no auth needed to view.
const PUBLIC_TOUR_PREFIXES = ["tourpanorama/", "tourcover/", "tourmarker/"];
// Room photos/360s, and now node panoramas too — genuinely protected,
// all converted to IndoorUploads_API. "panoramas/" joins this list now
// that the face-review pipeline itself has been converted (manual
// blurring only, per the client's own choice — no more Cloud Function
// dependency).
const PROTECTED_INDOOR_PREFIXES = ["roomphoto/", "room360/", "panoramas/"];

function getToken() {
  return localStorage.getItem("authToken");
}

// Hybrid version — recognizes the public tour path prefixes and
// resolves those as a direct URL against the new backend; recognizes
// the protected indoor prefixes (room photos, room 360s, and now node
// panoramas) and resolves those via an authenticated fetch; falls back
// to the original Firebase getBytes() logic only for anything genuinely
// not migrated yet (there's currently nothing left in that category,
// but the fallback stays in place rather than being removed
// prematurely, in case something surfaces later that still needs it).
//
// `photo` is expected to be a Storage path (e.g.
// "panoramas/gd1/gd1_f2_hallway01.jpg") for anything not yet migrated,
// which is what the still-Firebase-based upload utilities store. Nodes
// uploaded before an even earlier change might have a full https://
// download URL instead — the Storage path is extracted straight out of
// that legacy URL (it's embedded in it) rather than left on the old,
// unsecured link.
function extractStoragePath(photo) {
  if (!photo) return null;
  const match = photo.match(/\/o\/([^?]+)/);
  return match ? decodeURIComponent(match[1]) : photo;
}

export { extractStoragePath };

function matchesPublicTourPrefix(photo) {
  return PUBLIC_TOUR_PREFIXES.some((prefix) => photo.startsWith(prefix));
}

function matchesProtectedIndoorPrefix(photo) {
  return PROTECTED_INDOOR_PREFIXES.some((prefix) => photo.startsWith(prefix));
}

// Exported standalone — NodeForm.jsx's own "reopen an existing photo to
// add/adjust blur regions" flow (previously "re-scan for faces," before
// the client chose manual-only blurring) needs the exact same
// authenticated-fetch logic the hook below uses internally, but as an
// imperative, on-demand call rather than a reactive hook tied to a
// render. Centralized here rather than duplicated in NodeForm.jsx
// itself.
export async function fetchProtectedPhotoBytes(photo) {
  const token = getToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await fetch(`${API_BASE_URL}/IndoorUploads_API/serve?path=${encodeURIComponent(photo)}`, {
    headers,
  });
  if (!response.ok) {
    throw new Error("Couldn't load the existing photo.");
  }
  return response.blob();
}

export function useSecurePhotoUrl(photo) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setUrl(null);
    setError(null);
    if (!photo) return;

    // Public tour content — a plain, direct URL, no fetch needed at
    // all. Apache serves this as a static file.
    if (matchesPublicTourPrefix(photo)) {
      setUrl(`${API_BASE_URL.replace(/\/index\.php$/, "")}/uploads/${photo}`);
      return;
    }

    // Genuinely protected indoor content — an authenticated fetch
    // against IndoorUploads_API's serve() endpoint, converted to a
    // local blob URL the same way the Firebase branch below always
    // has. This is the real PHP-side equivalent of what getBytes() +
    // Storage Security Rules did before: the server checks the
    // requester's role before returning any bytes at all, not just
    // hiding the URL behind an unguessable path.
    if (matchesProtectedIndoorPrefix(photo)) {
      let cancelled = false;
      let objectUrl = null;

      const token = getToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      fetch(`${API_BASE_URL}/IndoorUploads_API/serve?path=${encodeURIComponent(photo)}`, { headers })
        .then((response) => {
          if (!response.ok) throw new Error("Couldn't load photo.");
          return response.blob();
        })
        .then((blob) => {
          if (cancelled) return;
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        })
        .catch((err) => {
          if (!cancelled) setError(err.message);
        });

      return () => {
        cancelled = true;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
    }

    // Everything else — original Firebase getBytes() logic, unchanged.
    const path = extractStoragePath(photo);
    if (!path) return;

    let cancelled = false;
    let objectUrl = null;

    getBytes(ref(storage, path))
      .then((bytes) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(new Blob([bytes]));
        setUrl(objectUrl);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photo]);

  return { url, error };
}
