import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTourStops } from "../hooks/useTourStops";
import { useTourSections } from "../hooks/useTourSections";
import { buildHotspots } from "../utils/hotspots";
import { useSecurePhotoUrl } from "../hooks/useSecurePhotoUrl";
import { useImagePreloaded } from "../hooks/useImagePreloaded";
import PanoramaNav from "../components/PanoramaNav";
import LoadingScreen from "../components/LoadingScreen";
import TourTutorialOverlay from "../components/TourTutorialOverlay";
import sdcaLogoReversedWhite from "../assets/images/sdca-logo-reversed-white.png";
import sdcaLogoFull from "../assets/images/sdca-logo-full.png";
import chevronLeftWhite from "../assets/icons/chevron-left-white.svg";
import menuWhite from "../assets/icons/menu-white.svg";

// Narrow screens: the scene list covers the whole width, so picking a scene
// closes it again (the visitor wants to see the place they picked).
const NARROW_QUERY = "(max-width: 640px)";

const byName = (a, b) => a.localeCompare(b, undefined, { sensitivity: "base" });

// Shows a stored photo's path, resolved via useSecurePhotoUrl the same way
// the rest of the app does. tourpanorama/tourcover are public
// photo kinds (see utils/photoStore.js), so they resolve to a plain static
// URL served by Apache, with no fetch or token involved. `fallback` stands
// in while there's no URL and if the file itself fails to load (e.g. a
// path whose file isn't on this server), rather than a broken-image icon.
function SecureImg({ path, alt, className, loading, fallback = null }) {
  const { url } = useSecurePhotoUrl(path);
  const [failedUrl, setFailedUrl] = useState(null);
  if (!url || url === failedUrl) return fallback;
  return <img src={url} alt={alt} className={className} loading={loading} onError={() => setFailedUrl(url)} />;
}

// A single description entry's truncate/expand behavior — CSS
// line-clamp collapsed by default, "Read More" lifts the clamp, matching
// the PHINMA reference exactly (screenshot showed a short, clamped
// panel with a "Read More" link; clicking it revealed the full,
// multi-paragraph text in place).
function DescriptionPanel({ stop }) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => setExpanded(false), [stop?.id]);

  if (!stop) return null;

  return (
    <div className="tour-description-panel">
      <h3>{stop.name}</h3>
      {stop.description ? (
        <>
          <p className={`tour-description-text ${expanded ? "" : "tour-description-clamped"}`}>
            {stop.description}
          </p>
          {!expanded && (
            <button className="tour-description-readmore" onClick={() => setExpanded(true)}>
              Read More
            </button>
          )}
        </>
      ) : (
        <p className="tour-description-text tour-description-empty">No description yet.</p>
      )}
    </div>
  );
}

// The ring at a scene tile's right: empty until the scene has been seen,
// then filled gold with a check (the reference's visited marker).
function VisitedMark({ visited }) {
  return (
    <svg className={`tour-visited-mark ${visited ? "tour-visited-mark-on" : ""}`} viewBox="0 0 30 30" aria-hidden="true">
      <circle className="tour-visited-ring" cx="15" cy="15" r="12" />
      <circle className="tour-visited-fill" cx="15" cy="15" r="10" />
      <path className="tour-visited-check" d="M10 15.5l3.2 3.2 6.8-7" />
    </svg>
  );
}

// One scene in the sidebar: its cover photo as the tile (or, without one,
// its 360° photo), the name over a dark wash, and the visited ring. The current scene drops the wash and gets a
// gold left edge.
function SceneTile({ stop, active, visited, onPick }) {
  return (
    <button
      className={`tour-scene ${active ? "tour-scene-active" : ""}`}
      onClick={() => onPick(stop.id)}
      aria-current={active ? "true" : undefined}
      aria-label={visited ? `${stop.name}, visited` : stop.name}
    >
      <SecureImg
        path={stop.coverPhoto || stop.photo || null}
        alt=""
        className="tour-scene-thumb"
        loading="lazy"
        fallback={<span className="tour-scene-thumb tour-scene-thumb-empty" />}
      />
      <span className="tour-scene-title">{stop.name}</span>
      <VisitedMark visited={visited} />
    </button>
  );
}

// The public Virtual Tour page — genuinely public, not wrapped in
// RequireAuth (see App.jsx), showcasing the campus grounds to visitors
// who aren't registered users at all. Laid out after the Nord Anglia
// virtual tour, in SDCA's colours:
//   - an intro over the dimmed first panorama (logo, "360 VIRTUAL TOUR",
//     Enter); the tour UI slides in once it's dismissed;
//   - the scene's name top-centre;
//   - a left sidebar — SDCA logo, every stop as a photo tile under its
//     section's heading, visited rings, and a Visited / to Visit count —
//     closed by default and reopened from the SCENES button;
//   - previous / next scene buttons bottom-centre, walking the sidebar's
//     order;
//   - the description panel, top-right, unchanged;
//   - a controls screen right after Enter (TourTutorialOverlay), on every
//     visit, and again from the ? button bottom-right.
// No search, no directions, no auto-walk, no minimap/flyover — none of
// MainPage.jsx's broader feature set applies here.
export default function PublicTourPage() {
  const { stops, loading: stopsLoading, selectedStopId, setSelectedStopId } = useTourStops();
  const { sections, loading: sectionsLoading } = useTourSections();

  const [entryYaw, setEntryYaw] = useState(0);
  const [entered, setEntered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [visited, setVisited] = useState(() => new Set());
  const enterRef = useRef(null);

  const byId = useMemo(() => Object.fromEntries(stops.map((s) => [s.id, s])), [stops]);

  // The sidebar, top to bottom: sections and sectionless stops in one
  // alphabetical order (case- and accent-insensitive), each section as a
  // heading over its own stops (alphabetical too). A section with no stops
  // is left out — there'd be nothing to pick under its heading.
  const groups = useMemo(() => {
    const sectionIds = new Set(sections.map((sec) => sec.id));
    const entries = [
      ...sections.map((sec) => ({
        key: `section-${sec.id}`,
        label: sec.label,
        heading: sec.label,
        stops: stops.filter((s) => s.section === sec.id).sort((a, b) => byName(a.name, b.name)),
      })),
      // A stop whose section no longer exists counts as sectionless.
      ...stops
        .filter((s) => !s.section || !sectionIds.has(s.section))
        .map((s) => ({ key: `stop-${s.id}`, label: s.name, heading: null, stops: [s] })),
    ];
    return entries.filter((g) => g.stops.length > 0).sort((a, b) => byName(a.label, b.label));
  }, [sections, stops]);

  // Every stop in sidebar order — what previous / next walk through.
  const order = useMemo(() => groups.flatMap((g) => g.stops), [groups]);

  // Opens on the sidebar's first stop once the stops (and sections, which
  // decide that order) have loaded and nothing's picked yet.
  useEffect(() => {
    if (!selectedStopId && !sectionsLoading && order.length > 0) {
      setSelectedStopId(order[0].id);
    }
  }, [order, selectedStopId, sectionsLoading, setSelectedStopId]);

  const current = selectedStopId ? byId[selectedStopId] : null;
  const { url: photoUrl, error: photoError } = useSecurePhotoUrl(current?.photo);

  // Waits for BOTH the initial data AND the current stop's actual photo
  // bytes to be decoded and paintable — not just the data existing, per
  // the confirmed design. A stop with no photo set at all has nothing to
  // wait for on that front (photoReady is true immediately), so a
  // photo-less stop can't leave a visitor stuck on the loading screen
  // forever. Same for a photo that fails to resolve (a missing file, or a
  // path that isn't a real Photo path): `photoUrl` then stays null, so
  // useImagePreloaded never even starts — without `photoError` here the
  // page sat on "Loading tour…" forever instead of showing PanoramaNav's
  // "no image" placeholder. useNodePhoto does the same for indoor nodes.
  const imageLoaded = useImagePreloaded(photoUrl);
  const photoReady = !current?.photo || imageLoaded || !!photoError;
  const stillLoading = stopsLoading || sectionsLoading || !current || !photoReady;

  const hotspots = useMemo(() => (current ? buildHotspots(current, byId) : []), [current, byId]);

  // The intro's Enter takes focus once the loading screen is gone, so
  // Enter/Space on the keyboard starts the tour too.
  useEffect(() => {
    if (!stillLoading && !entered) enterRef.current?.focus();
  }, [stillLoading, entered]);

  // Escape closes the scene list.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // No "back" tracking here — confirmed not wanted on this page (it was
  // modeled after the indoor system's own goTo/history/back pattern in
  // MainPage.jsx, but "literally just a tour" means walking via a
  // hotspot and picking a stop from the sidebar both just go straight to
  // that stop, nothing more).
  // A scene counts as visited once it's been shown with the tour UI up
  // (the intro's dimmed backdrop doesn't count): on Enter, and on every
  // move after it. Per visit only, like the reference — a fresh page load
  // starts the count again.
  const markVisited = (id) => {
    if (id) setVisited((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  };

  const enter = () => {
    setEntered(true);
    setTutorialOpen(true);
    markVisited(selectedStopId);
  };

  const goTo = (id, angle) => {
    setSelectedStopId(id);
    markVisited(id);
    setEntryYaw(angle?.yaw ?? 0);
  };

  const jumpToStop = (id) => {
    setSelectedStopId(id);
    markVisited(id);
    setEntryYaw(0);
  };

  const pickFromList = (id) => {
    jumpToStop(id);
    if (window.matchMedia(NARROW_QUERY).matches) setMenuOpen(false);
  };

  // Previous / next, wrapping round at either end of the list.
  const step = (delta) => {
    if (order.length === 0) return;
    const at = order.findIndex((s) => s.id === selectedStopId);
    const next = order[(Math.max(at, 0) + delta + order.length) % order.length];
    jumpToStop(next.id);
  };

  // Waits for stopsLoading specifically, not just stops.length===0 —
  // without this, a slow Firestore response could briefly flash this
  // "genuinely empty" message before the real data arrives, since both
  // states look identical (stops.length===0) until the first snapshot
  // actually lands.
  if (!stopsLoading && stops.length === 0) {
    return (
      <div className="tour-page tour-page-empty">
        <p>No tour stops available yet.</p>
        <Link to="/">
          <img src={chevronLeftWhite} alt="" className="inline-icon-img" /> Back to Main Page
        </Link>
      </div>
    );
  }

  const visitedCount = order.filter((s) => visited.has(s.id)).length;
  const pageClass = ["tour-page", entered ? "" : "tour-ui-hidden", menuOpen ? "tour-menu-open" : ""].join(" ");

  return (
    <div className={pageClass}>
      <LoadingScreen show={stillLoading} label="Loading tour…" />

      {/* Genuinely different from the empty-state check above — stops DO
          exist here, but `current` may still be null for one render
          tick: the useEffect that auto-selects the first stop runs
          AFTER the initial render, not before it. Rendering PanoramaNav
          below assumes a real current stop (key={current.id}), so this
          waits for one to actually exist — the loading screen above is
          already covering this gap regardless, via stillLoading
          including !current. */}
      {current && (
        <>
          <div className="tour-screen">
            <PanoramaNav
              key={current.id}
              url={photoUrl || ""}
              hotspots={hotspots}
              onNavigate={goTo}
              onError={() => {}}
              placing={false}
              onPlaceAngle={() => {}}
              initialYaw={entryYaw}
            />
          </div>

          {/* The scene's name, top-centre (the logo lives in the sidebar). */}
          <div className="tour-title-bar" aria-live="polite">
            <h1 className="tour-scene-name">{current.name}</h1>
          </div>

          <DescriptionPanel stop={current} />

          <div className="tour-step-nav">
            <button className="tour-step-btn tour-step-prev" onClick={() => step(-1)} aria-label="Previous scene">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button className="tour-step-btn tour-step-next" onClick={() => step(1)} aria-label="Next scene">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          <button className="tour-help-btn" onClick={() => setTutorialOpen(true)} aria-label="How to explore (tips)">
            ?
          </button>

          <button
            className="tour-scenes-btn"
            onClick={() => setMenuOpen(true)}
            aria-label="Show scenes"
            aria-expanded={menuOpen}
            aria-controls="tour-sidebar"
          >
            <img src={menuWhite} alt="" />
            <span className="tour-scenes-btn-text">Scenes</span>
          </button>

          {/* Inert while closed: off-screen, so nothing in it takes focus. */}
          <nav id="tour-sidebar" className="tour-sidebar" aria-label="Scenes" inert={!menuOpen}>
            <div className="tour-sidebar-header">
              <img src={sdcaLogoFull} alt="St. Dominic College of Asia" className="tour-sidebar-logo" />
              <button className="tour-sidebar-close" onClick={() => setMenuOpen(false)} aria-label="Close scenes">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              </button>
            </div>

            <div className="tour-sidebar-list">
              {groups.map((g) => (
                <div key={g.key} className="tour-sidebar-group">
                  {g.heading && <h2 className="tour-sidebar-heading">{g.heading}</h2>}
                  {g.stops.map((s) => (
                    <SceneTile
                      key={s.id}
                      stop={s}
                      active={s.id === selectedStopId}
                      visited={visited.has(s.id)}
                      onPick={pickFromList}
                    />
                  ))}
                </div>
              ))}
            </div>

            <div className="tour-progress">
              <span className="tour-progress-item">
                <VisitedMark visited />
                {visitedCount} - Visited
              </span>
              <span className="tour-progress-item">
                <VisitedMark visited={false} />
                {order.length - visitedCount} - to Visit
              </span>
            </div>
          </nav>

          <TourTutorialOverlay open={tutorialOpen} onDismiss={() => setTutorialOpen(false)} />

          {/* The intro, over the dimmed first panorama. */}
          {!entered && (
            <div className="tour-intro">
              <img src={sdcaLogoReversedWhite} alt="St. Dominic College of Asia" className="tour-intro-logo" />
              <p className="tour-intro-subtitle">360 Virtual Tour</p>
              <button ref={enterRef} className="tour-intro-enter" onClick={enter}>
                Enter
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
