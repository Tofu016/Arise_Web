import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTourStops } from "../hooks/useTourStops";
import { useTourSections } from "../hooks/useTourSections";
import { buildHotspots } from "../utils/hotspots";
import { useSecurePhotoUrl } from "../hooks/useSecurePhotoUrl";
import { useImagePreloaded } from "../hooks/useImagePreloaded";
import PanoramaNav from "../components/PanoramaNav";
import LoadingScreen from "../components/LoadingScreen";

// Shows a Storage path's photo, resolved via useSecurePhotoUrl the same
// secure-fetch way the rest of the app already does — that call still
// works for an anonymous visitor here specifically because
// tourpanorama/tourcover/tourmarker each have their own genuinely public
// Storage rule (see storage.rules), unlike every other photo path in
// this app.
function SecureImg({ path, alt, className }) {
  const { url } = useSecurePhotoUrl(path);
  if (!url) return null;
  return <img src={url} alt={alt} className={className} />;
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

// One Section's row in the sidebar — cover photo, label, expand arrow;
// expanding reveals that section's own stops as a plain text list, same
// shape as the PHINMA reference's own collapsible campus/building rows.
function SectionRow({ section, stopsInSection, expanded, onToggle, currentStopId, onPickStop }) {
  // Falls back to a stop's own 360° photo when the section has no
  // explicit cover photo of its own — avoids the extra step of
  // uploading a separate cover image when a perfectly good one may
  // already exist. Still prefers an explicit section.coverPhoto when one
  // IS set, though: a raw 360° panorama often looks visibly distorted
  // cropped down to a flat thumbnail, so a deliberately-chosen cover
  // photo stays the better default whenever an admin bothered to set
  // one. When falling back, picks alphabetically by name (matching the
  // sidebar's own ordering) among stops that actually have a photo, for
  // a consistent, predictable choice rather than whatever order
  // Firestore happens to return.
  const fallbackStop = [...stopsInSection]
    .filter((s) => s.photo)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))[0];
  const thumbPath = section.coverPhoto || fallbackStop?.photo || null;

  return (
    <div className="tour-sidebar-section">
      <button className="tour-sidebar-section-header" onClick={onToggle}>
        <span className="tour-sidebar-section-thumb">
          {thumbPath ? (
            <SecureImg path={thumbPath} alt={section.label} />
          ) : (
            <span className="tour-sidebar-section-thumb-empty" />
          )}
        </span>
        <span className="tour-sidebar-section-label">{section.label}</span>
        <span className="tour-sidebar-section-caret">{expanded ? "▾" : "▸"}</span>
      </button>
      {expanded && (
        <div className="tour-sidebar-stop-list">
          {stopsInSection.length === 0 && (
            <p className="tour-sidebar-stop-empty">No stops in this section yet.</p>
          )}
          {stopsInSection.map((s) => (
            <button
              key={s.id}
              className={`tour-sidebar-stop-item ${s.id === currentStopId ? "tour-sidebar-stop-item-active" : ""}`}
              onClick={() => onPickStop(s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// The equipment marker's "Click to view photos" carousel/lightbox —
// matches the PHINMA reference's own carousel: large image, prev/next
// arrows, a thumbnail strip along the bottom.
function MarkerPhotoCarousel({ marker, onClose }) {
  const [index, setIndex] = useState(0);
  const photos = marker.photos || [];
  const { url } = useSecurePhotoUrl(photos[index]);

  const prev = () => setIndex((i) => (i - 1 + photos.length) % photos.length);
  const next = () => setIndex((i) => (i + 1) % photos.length);

  return (
    <div className="modal-overlay tour-carousel-overlay" onClick={onClose}>
      <div className="tour-carousel" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn tour-carousel-close" onClick={onClose}>✕</button>
        <div className="tour-carousel-main">
          {photos.length > 1 && (
            <button className="tour-carousel-arrow tour-carousel-arrow-prev" onClick={prev}>‹</button>
          )}
          {url && <img src={url} alt={marker.label} className="tour-carousel-image" />}
          {photos.length > 1 && (
            <button className="tour-carousel-arrow tour-carousel-arrow-next" onClick={next}>›</button>
          )}
        </div>
        {photos.length > 1 && (
          <div className="tour-carousel-thumbs">
            {photos.map((p, i) => (
              <button
                key={p}
                className={`tour-carousel-thumb ${i === index ? "tour-carousel-thumb-active" : ""}`}
                onClick={() => setIndex(i)}
              >
                <SecureImg path={p} alt="" />
              </button>
            ))}
          </div>
        )}
        <p className="tour-carousel-label">{marker.label}</p>
      </div>
    </div>
  );
}

// The public Virtual Tour page — genuinely public, not wrapped in
// RequireAuth (see App.jsx), showcasing the campus grounds to visitors
// who aren't registered users at all. "Literally just a tour": panorama
// + clickable hotspots to walk between stops, a transparent header and
// sidebar (no app chrome, matching the PHINMA/Nord Anglia references),
// a persistent description panel, and equipment markers opening a photo
// carousel. No search, no directions, no auto-walk, no minimap/flyover —
// none of MainPage.jsx's broader feature set applies here.
export default function PublicTourPage() {
  const { stops, loading: stopsLoading, selectedStopId, setSelectedStopId } = useTourStops();
  const { sections, loading: sectionsLoading } = useTourSections();

  const [entryYaw, setEntryYaw] = useState(0);
  const [expandedSectionId, setExpandedSectionId] = useState(null);
  const [carouselMarker, setCarouselMarker] = useState(null);

  const byId = useMemo(() => Object.fromEntries(stops.map((s) => [s.id, s])), [stops]);
  const uncategorizedStops = useMemo(() => stops.filter((s) => !s.section), [stops]);

  // A single, unified alphabetical order across BOTH sections and
  // standalone stops together — not sections-then-stops or vice versa,
  // genuinely interleaved by whichever name/label comes first. Each
  // entry carries its own type so the render below knows whether to
  // draw a SectionRow or a plain stop item for it. localeCompare with
  // sensitivity:"base" for a real alphabetical sort (case- and
  // accent-insensitive), not JS's default case-sensitive < comparison.
  const sidebarEntries = useMemo(() => {
    const sectionEntries = sections.map((sec) => ({ type: "section", key: sec.id, label: sec.label, data: sec }));
    const stopEntries = uncategorizedStops.map((s) => ({ type: "stop", key: s.id, label: s.name, data: s }));
    return [...sectionEntries, ...stopEntries].sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
    );
  }, [sections, uncategorizedStops]);

  // Auto-selects the first available stop once the (async, onSnapshot-
  // backed) stops list actually loads and nothing's picked yet — the
  // public page should show something by default, not an empty state,
  // the moment there's any content to show at all.
  useEffect(() => {
    if (!selectedStopId && stops.length > 0) {
      setSelectedStopId(stops[0].id);
    }
  }, [stops, selectedStopId, setSelectedStopId]);

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

  const markers = current?.markers || [];

  // No "back" tracking here — confirmed not wanted on this page (it was
  // modeled after the indoor system's own goTo/history/back pattern in
  // MainPage.jsx, but "literally just a tour" means walking via a
  // hotspot and picking a stop from the sidebar both just go straight to
  // that stop, nothing more).
  const goTo = (id, angle) => {
    setSelectedStopId(id);
    setEntryYaw(angle?.yaw ?? 0);
  };

  const jumpToStop = (id) => {
    setSelectedStopId(id);
    setEntryYaw(0);
  };

  const toggleSection = (id) => {
    setExpandedSectionId((cur) => (cur === id ? null : id));
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
        <Link to="/">← Back to Main Page</Link>
      </div>
    );
  }

  return (
    <div className="tour-page">
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
          <div className="tour-header">
            {/* Deliberately empty for now — transparent, no title text yet,
                per the confirmed design. No link back to Main Page here — a
                public visitor browsing this page has no reason to go to the
                authenticated indoor tour at all. */}
          </div>

          <div className="tour-screen">
            <PanoramaNav
              key={current.id}
              url={photoUrl || ""}
              hotspots={hotspots}
              markers={markers}
              onNavigate={goTo}
              onEquipmentMarkerClick={setCarouselMarker}
              onError={() => {}}
              placing={false}
              onPlaceAngle={() => {}}
              initialYaw={entryYaw}
            />
          </div>

          <DescriptionPanel stop={current} />

          <div className="tour-sidebar">
            {sidebarEntries.map((entry) =>
              entry.type === "section" ? (
                <SectionRow
                  key={entry.key}
                  section={entry.data}
                  stopsInSection={stops.filter((s) => s.section === entry.data.id)}
                  expanded={expandedSectionId === entry.data.id}
                  onToggle={() => toggleSection(entry.data.id)}
                  currentStopId={selectedStopId}
                  onPickStop={jumpToStop}
                />
              ) : (
                <button
                  key={entry.key}
                  className={`tour-sidebar-loose-stop-item ${entry.data.id === selectedStopId ? "tour-sidebar-stop-item-active" : ""}`}
                  onClick={() => jumpToStop(entry.data.id)}
                >
                  <span className="tour-sidebar-section-thumb">
                    {entry.data.photo ? (
                      <SecureImg path={entry.data.photo} alt={entry.data.name} />
                    ) : (
                      <span className="tour-sidebar-section-thumb-empty" />
                    )}
                  </span>
                  <span className="tour-sidebar-section-label">{entry.data.name}</span>
                </button>
              )
            )}
          </div>

          {carouselMarker && (
            <MarkerPhotoCarousel marker={carouselMarker} onClose={() => setCarouselMarker(null)} />
          )}
        </>
      )}
    </div>
  );
}
