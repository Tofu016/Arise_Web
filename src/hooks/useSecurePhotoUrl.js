import { useEffect, useState } from "react";

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

// Recognizes the public tour path prefixes and resolves those as a
// direct URL against the PHP backend; recognizes the protected indoor
// prefixes (room photos, room 360s, node panoramas) and resolves those
// via an authenticated fetch through IndoorUploads_API. Any path
// matching neither set is unsupported legacy data — it used to fall
// through to Firebase Storage, which was removed once the migration to
// the PHP backend was complete.
//
// `photo` is a backend storage path, e.g.
// "panoramas/gd1/gd1_f2_hallway01.jpg". Nodes saved before an early
// change may carry a full https:// download URL instead — the storage
// path is extracted straight out of that legacy URL (it's embedded in
// it) rather than used as-is.
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

    // Neither prefix set matched — legacy data that used to resolve
    // through Firebase Storage. The migration moved every known path
    // under the prefixes handled above, so nothing in the current
    // dataset reaches here; surface it plainly instead of failing
    // silently or pulling the Firebase SDK back in for a case that no
    // longer occurs.
    setError(
      "This image uses an old storage path that's no longer supported — re-upload it from the editor."
    );
  }, [photo]);

  return { url, error };
}
