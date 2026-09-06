import { useEffect, useState } from "react";

// Full-screen loading overlay, shared by MainPage.jsx and
// PublicTourPage.jsx — both need identical behavior (branded background,
// spinner, smooth fade-out), so this lives as its own component rather
// than being duplicated in each page.
//
// Manages its own delayed unmount internally: when `show` flips to
// false, this stays mounted just long enough to finish its own CSS
// fade-out transition (matching FADE_MS below) before actually
// disappearing, so the caller doesn't need to coordinate that timing
// itself — just pass `show={stillLoading}` and this handles the rest.
const FADE_MS = 400;

export default function LoadingScreen({ show, label = "Loading…" }) {
  const [mounted, setMounted] = useState(show);

  useEffect(() => {
    if (show) {
      setMounted(true);
      return;
    }
    if (mounted) {
      const t = setTimeout(() => setMounted(false), FADE_MS);
      return () => clearTimeout(t);
    }
  }, [show, mounted]);

  if (!mounted) return null;

  return (
    <div className={`loading-screen ${show ? "" : "loading-screen-hidden"}`}>
      <div className="loading-spinner" />
      <p className="loading-screen-label">{label}</p>
    </div>
  );
}
