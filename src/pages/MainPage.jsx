import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import PanoramaNav from "../components/PanoramaNav";
import LoadingScreen from "../components/LoadingScreen";
import RoomCard from "../components/RoomCard";
import Room360Modal from "../components/Room360Modal";
import CrossCampusMinimap from "../components/CrossCampusMinimap";
import FlyoverPanel from "../components/FlyoverPanel";
import MobileRoomSheet from "../components/MobileRoomSheet";
import KioskDialog from "../components/KioskDialog";
import FeedbackPanel from "../components/FeedbackPanel";
import IdlePrompt from "../components/IdlePrompt";
import { useIdleDetector } from "../hooks/useIdleDetector";
import { allBuildings, buildingLabel, floorLabel } from "../utils/constants";
import { buildHotspots } from "../utils/hotspots";
import { useCustomBuildingsVersion } from "../utils/buildingStore";
import { buildSearchableRooms, findRoomForMarker, pickSuggestions, searchCampus } from "../utils/search";
import { pickDefaultEntranceForBuilding } from "../utils/navigation";
import * as route from "../utils/directionsRoute";
import { useNavigation } from "../hooks/useNavigation";
import { useDirections, useAutoWalk } from "../hooks/useDirections";
import { usePublicNodes } from "../hooks/usePublicNodes";
import { useSecurePhotoUrl } from "../hooks/useSecurePhotoUrl";
import { prefetchPhoto } from "../utils/photoStore";
import { KIOSK_TOP_INSET, KIOSK_BOTTOM_INSET, KIOSK_PANORAMA_FRACTION } from "../utils/kioskLayout";
import { useImagePreloaded } from "../hooks/useImagePreloaded";
import { usePlacardDialogs } from "../hooks/usePlacardDialogs";
import { useAuth } from "../context/useAuth";

// Breakpoint-driven layout swap: below a width threshold, OR whenever the
// screen is genuinely tall/portrait, this switches to the stacked
// bottom-anchored layout (bottom sheets, bottom controls) instead of the
// desktop floating UI. There's no separate kiosk build — a wall-mounted
// kiosk is "vertically tall like a mobile phone" but can be much WIDER
// than one (e.g. a 1080×1920 portrait touchscreen), so width alone would
// miss it; the aspect-ratio check catches any portrait screen with real
// height-over-width, regardless of its absolute size, and it gets
// exactly the same treatment a phone does. Re-evaluated on resize/rotate.
//
// Deliberately a ratio, not an exact 1080×1920 match: innerWidth/innerHeight
// are CSS pixels, so Windows display scaling (125% → 864×1536) and browser
// chrome/taskbar (windowed, not F11/--kiosk) both change the reported size.
// The kiosk's ratio is ~1.78; 1.3 leaves a wide margin below that while
// keeping a merely slightly-portrait desktop window on the desktop layout
// (portrait tablets, ~1.33, still get the shared touch layout).
const PORTRAIT_ASPECT_THRESHOLD = 1.3;

function isMobileLayout(breakpoint = 768) {
  if (typeof window === "undefined") return false;
  const { innerWidth: w, innerHeight: h } = window;
  return w <= breakpoint || h > w * PORTRAIT_ASPECT_THRESHOLD;
}

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => isMobileLayout(breakpoint));
  useEffect(() => {
    const onResize = () => setIsMobile(isMobileLayout(breakpoint));
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [breakpoint]);
  return isMobile;
}

// Mobile/kiosk control dock: how far each radial icon sits from the
// FAB's center (RADIAL_RADIUS, in px) and how much of a clock-face arc
// they're fanned across (RADIAL_SPREAD_DEG, in degrees) — swept only
// across the FAB's left side, like the 7-through-11 o'clock positions,
// since the FAB itself sits at the screen's right edge with nothing but
// more screen to its left. Kept as named constants since the actual
// per-button placement (radialButtonTransform below) has to reproduce
// this same geometry in JS, not just CSS.
const RADIAL_RADIUS = 104;
const RADIAL_SPREAD_DEG = 150;

// Returns the CSS transform that places one radial icon's CENTER at the
// correct point on the arc, given its position (index) among however
// many are actually showing (total) — evenly spaced regardless of which
// optional ones (Back, Account) are present this render. angle 0 points
// straight left; positive angles sweep upward (screen Y is inverted
// from standard math Y, hence the negated sin here).
function radialButtonTransform(index, total) {
  const angleDeg = total > 1 ? -RADIAL_SPREAD_DEG / 2 + (index * RADIAL_SPREAD_DEG) / (total - 1) : 0;
  const angleRad = (angleDeg * Math.PI) / 180;
  const x = -Math.cos(angleRad) * RADIAL_RADIUS; // fans out to the left of the FAB
  const y = -Math.sin(angleRad) * RADIAL_RADIUS;
  return `translate(${x}px, ${y}px)`;
}

export default function MainPage() {
  useCustomBuildingsVersion(); // pick up admin-created buildings without a reload
  const { user, profile, role, signOut } = useAuth();
  const isMobile = useIsMobile();

  const { nodes, error: loadError } = usePublicNodes();
  const [buildingFilter, setBuildingFilter] = useState("all");

  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef(null);

  // Single source of truth for what the floating panel below the search bar
  // is currently showing — only one thing at a time, Maps-style:
  // null | "menu" (desktop hamburger) | "search" | "room" | "directions" | "account" (mobile only)
  const [panelMode, setPanelMode] = useState(null);
  const closePanel = () => setPanelMode(null);
  const toggleMenu = () => setPanelMode((m) => (m === "menu" ? null : "menu"));

  // Mobile/kiosk only: the search bar, primary actions, and Building
  // selector are collapsed behind a single FAB on the middle-right edge
  // (reachable at arm's length by someone standing at a wall-mounted
  // kiosk) rather than sitting permanently on screen — a search bar just
  // parked there on its own would be poor UX. Deliberately its own state,
  // separate from panelMode: panelMode still tracks what's showing
  // *inside* the expanded panel (search results vs. the account panel),
  // this just tracks whether the panel is expanded at all. Blurring the
  // search input (closePanel, via onBlur) intentionally does NOT collapse
  // this — that fires on every incidental focus change within the panel
  // (e.g. tapping the Building selector while the keyboard's still up)
  // and would yank the panel away mid-interaction. It only collapses on
  // an explicit close (the FAB itself, the backdrop, Escape) or once a
  // navigation actually happens (see goTo/goBack/jumpToSearchResult) —
  // at that point the visitor has what they came for and the panorama
  // should be fully visible again.
  const [mobileDockOpen, setMobileDockOpen] = useState(false);
  const closeMobileDock = () => {
    setPanelMode(null);
    setMobileDockOpen(false);
  };

  // Its own independent state, not tied to panelMode — this is a
  // separate, standalone overlay (its own button, its own dismissible
  // panel), not part of the search/account panel system at all.
  const [showFeedback, setShowFeedback] = useState(false);

  // The backdrop behind the panel is purely visual on desktop (see
  // .floating-panel-backdrop's pointer-events: none) — it deliberately does
  // NOT intercept clicks there, so the panorama stays freely draggable
  // underneath. Escape is the keyboard-accessible way to close it instead of
  // a backdrop click.
  useEffect(() => {
    if (!panelMode && !mobileDockOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") closeMobileDock();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [panelMode, mobileDockOpen]);

  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef(null);
  useEffect(() => {
    if (!accountMenuOpen) return;
    const handleOutsideClick = (e) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target)) setAccountMenuOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [accountMenuOpen]);

  // Mobile's Building selector opens as its own centered modal (see
  // .mobile-building-modal) rather than a dropdown — dismissed the same
  // way every other mobile modal is (its own close button or backdrop
  // tap), so unlike a dropdown it needs no outside-click listener.
  const [buildingMenuOpen, setBuildingMenuOpen] = useState(false);

  const byId = useMemo(() => Object.fromEntries((nodes || []).map((n) => [n.id, n])), [nodes]);

  // Where the visitor is standing, their history, and any cross-campus
  // flyover in progress — see utils/navigation.js.
  const nav = useNavigation(nodes, byId);
  const { currentId, history, entryYaw, flyover } = nav;

  // Point-to-point directions ("just like Street View"): opened from a
  // search result, holds the from/to text + resolved node ids, the computed
  // path once requested, and how far along it the visitor currently is —
  // see utils/directionsRoute.js for its shape.
  const [directions, setDirections] = useDirections(nodes, currentId);

  // Rooms with actual detail records (photo/description/department/use) —
  // built by matching each node's "Rooms served" entries against
  // placardDialogs. Only rooms an admin has actually gone through Room Edit
  // for show up in search this way; a room existing on a node alone isn't
  // enough, since there'd be nothing to show on the card.
  const { getForRoom } = usePlacardDialogs();
  const searchableRooms = useMemo(() => buildSearchableRooms(nodes, getForRoom), [nodes, getForRoom]);

  // Room search always scans the whole campus regardless of the building filter —
  // that filter only picks which entrances are offered to browse from, it
  // shouldn't stop someone from finding "203" just because they'd selected GD2.
  const { roomResults, placeResults } = useMemo(
    () => searchCampus(searchQuery, nodes, searchableRooms),
    [nodes, searchQuery, searchableRooms]
  );

  // A quick "don't know what to search for" starting point — a fresh random
  // sample of rooms (that actually have detail records) shown the moment the
  // (empty) search box is focused, re-shuffled each time it's opened.
  const randomSuggestions = useMemo(() => {
    return pickSuggestions(searchableRooms);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelMode === "search", searchableRooms]);

  // The currently-open Google-Maps-style room detail card, or null.
  const [selectedRoomCard, setSelectedRoomCard] = useState(null);
  const [room360Open, setRoom360Open] = useState(false);
  const entrances = useMemo(() => {
    if (!nodes) return [];
    return nodes.filter(
      (n) => n.type === "entrance" && (buildingFilter === "all" || n.building === buildingFilter)
    );
  }, [nodes, buildingFilter]);

  const current = currentId ? byId[currentId] : null;

  // Cross-campus minimap eligibility — only entrance-type nodes, excluding
  // GD2/GD3 specifically since they're part of the same physically
  // interconnected cluster as GD1 (which already represents the whole
  // cluster on its own — no need for every building in it to carry its
  // own copy of the widget). Only actually renders once the building also
  // has real coordinates set, since not every building has this yet
  // (Digital Campus doesn't, as of writing this).
  const currentBuildingMeta = current ? allBuildings().find((b) => b.id === current.building) : null;
  const showMinimap =
    current?.type === "entrance" &&
    current.building !== "gd2" &&
    current.building !== "gd3" &&
    currentBuildingMeta?.lat != null &&
    currentBuildingMeta?.lng != null;

  // A single named constant, easy to retune. Suppressed entirely (enabled: false, no
  // timer even running) whenever any other overlay is already open, so
  // this can never appear stacked on top of the search panel, the
  // feedback panel itself, a room's 360 view, or a flyover — each of
  // those already means the visitor is actively doing
  // something, not idle in the sense this prompt cares about. Declared
  // here, after all of those, since it reads their current values —
  // JS's temporal dead zone would break this if placed any earlier.
  const IDLE_TIMEOUT_MS = 60000;
  const idleDetectorEnabled = !panelMode && !mobileDockOpen && !showFeedback && !room360Open && !flyover;
  const [isIdle, resetIdle] = useIdleDetector(IDLE_TIMEOUT_MS, idleDetectorEnabled);

  // Called unconditionally here (before any early returns below) since it's
  // a hook — the value is only actually used once we reach the main render.
  const { url: securePhotoUrl } = useSecurePhotoUrl(current?.photo, { cached: true });

  // Same "called before any early return" reasoning as securePhotoUrl
  // above — tracks whether the current photo's actual bytes have been
  // decoded and are paintable, not just that the secure-fetch URL
  // resolved. Used below to decide when the FIRST-LOAD splash screen can
  // dismiss; initialLoadDone latches true the first time this succeeds
  // and never resets, so walking to a different node later (which
  // briefly has its own, much smaller .photo-transition-indicator
  // already) doesn't re-trigger the full-screen splash a second time.
  // photoReady (not imageLoaded alone) also covers the edge case where
  // no current node/photo ever ends up set at all (e.g. genuinely zero
  // nodes configured) — without this, imageLoaded would never resolve
  // and the splash would stay stuck forever with nothing to wait for.
  const imageLoaded = useImagePreloaded(securePhotoUrl);
  const photoReady = !current?.photo || imageLoaded;
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  useEffect(() => {
    if (nodes && photoReady && !initialLoadDone) {
      setInitialLoadDone(true);
    }
  }, [nodes, photoReady, initialLoadDone]);

  const hotspots = useMemo(
    () => (current ? buildHotspots(current, byId, { withPhoto: true }) : []),
    [current, byId]
  );

  const markers = current?.markers || [];

  // Once this node's own photo is up, quietly fetch the photos its hotspots
  // lead to, one at a time (so they never crowd out a photo the visitor
  // actually tapped), the next stop on an active route first. Together with
  // photoStore's cache this makes a move a swap, not a download. Capped at
  // the cache's idle size; a tapped photo already in flight is simply shared.
  const PREFETCH_LIMIT = 6;
  const routeNextId = route.nextStep(directions, hotspots)?.id;
  const prefetchKey = imageLoaded
    ? hotspots
        .filter((h) => h.photo && h.id !== current?.id)
        .sort((a, b) => (b.id === routeNextId) - (a.id === routeNextId))
        .slice(0, PREFETCH_LIMIT)
        .map((h) => h.photo)
        .join("|")
    : "";
  useEffect(() => {
    if (!prefetchKey) return;
    let cancelled = false;
    (async () => {
      for (const photo of prefetchKey.split("|")) {
        if (cancelled) return;
        await prefetchPhoto(photo);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [prefetchKey]);

  // What follows a move that actually happened — everything the navigation
  // module deliberately knows nothing about: the search box, the open
  // panel, the room card.
  const afterMove = (action) => {
    if (action.type === "back") return;
    setSearchQuery("");
    if (action.type === "walk") return;
    if (action.meta?.room) {
      setSelectedRoomCard(action.meta.room);
      setPanelMode("room");
    } else {
      closePanel();
    }
  };

  // Hotspot click, and "Walk to next stop" in directions.
  const goTo = (id, angle) => {
    const { outcome, action } = nav.walk(id, angle?.yaw);
    if (outcome === "ignored") return;
    setMobileDockOpen(false);
    if (outcome === "moved") afterMove(action);
  };

  const goBack = () => {
    const { outcome, action } = nav.back();
    if (outcome === "ignored") return;
    setMobileDockOpen(false);
    if (outcome === "moved") afterMove(action);
  };

  // Jumping in from search/an entrance/directions/a room card is a fresh
  // start, not a "walk from where I was" — there's no path shown yet, just a
  // direct hop. Also dismisses whatever the floating panel was showing, same
  // as Maps closing search/place-details once you actually navigate somewhere.
  // Every cross-campus move gets a flyover first, this included.
  const jumpToSearchResult = (id, meta) => {
    const { outcome, action } = nav.jump(id, meta);
    if (outcome === "ignored") return;
    setMobileDockOpen(false);
    if (outcome === "moved") afterMove(action);
    else closePanel(); // dismiss whatever panel was open, even though the actual jump itself is deferred
  };

  // Called once the flyover sequence finishes (auto-proceed or Skip).
  const completeFlyover = () => {
    const { action } = nav.completeFlyover();
    if (action) afterMove(action);
  };

  // Cancelling just closes the flyover — the visitor stays exactly where
  // they already were, no move happens at all.
  const cancelFlyover = () => nav.cancelFlyover();

  // Opening directions always REPLACES whatever the panel was showing
  // (search results, a room card, the menu) — same as Maps switching from
  // place details straight into directions mode, not stacking both.
  const openDirectionsTo = (node) => {
    setMobileDockOpen(false);
    setDirections(route.openDirectionsTo(current, node));
    setSearchQuery("");
    setPanelMode("directions");
  };

  const openDirectionsToNearestExit = () => {
    if (!current || !nodes) return;
    setMobileDockOpen(false);
    setDirections(route.openNearestExit(current, nodes));
    setSearchQuery("");
    setPanelMode("directions");
  };

  const closeDirections = () => {
    setDirections(null);
    closePanel();
  };

  // Selecting a room from search moves the viewer to its attached node (a
  // jump, so it flies over a campus boundary like any other) and opens its
  // info card once it lands. "Get Directions"/"360° View" on the card itself
  // are the explicit actions that go further.
  const openRoomCard = (room) => jumpToSearchResult(room.node.id, { room });

  // Clicking a "room" type marker in the panorama itself. If no saved room
  // details exist for that label, nothing happens — same "only rooms an admin
  // has actually gone through Room Edit for are actionable" rule search
  // already follows.
  const handleRoomMarkerClick = (marker) => {
    const match = findRoomForMarker(marker, searchableRooms);
    if (match) openRoomCard(match);
  };

  const closeRoomCard = () => {
    setSelectedRoomCard(null);
    closePanel();
  };

  const handleRoomGetDirections = () => {
    if (!selectedRoomCard) return;
    openDirectionsTo(selectedRoomCard.node);
  };

  // Opens the room's OWN photo360 (set via the "360° room photo" field in
  // Room Edit) as a standalone viewer. The button is disabled in RoomCard
  // when no photo360 is set, so this can assume one exists.
  const handleRoomView360 = () => {
    if (!selectedRoomCard?.placard?.photo360) return;
    setRoom360Open(true);
  };

  const updateDirectionsField = (field, value) => setDirections((d) => route.editField(d, field, value));
  const pickDirectionsField = (field, node) => setDirections((d) => route.pickNodeField(d, field, node));
  const pickDirectionsFieldRoom = (field, room) => setDirections((d) => route.pickRoomField(d, field, room));

  // Same "rooms first, places second, no duplicates" structure as the main
  // search bar — the From/To fields search rooms too.
  const directionsQuery = route.activeQuery(directions);
  const { roomResults: directionsRoomMatches, placeResults: directionsPlaceMatches } = useMemo(
    () =>
      directions?.editingField && directionsQuery.trim()
        ? searchCampus(directionsQuery, nodes, searchableRooms)
        : { roomResults: [], placeResults: [] },
    [directions?.editingField, directionsQuery, nodes, searchableRooms]
  );

  const handleGetDirections = () => setDirections((d) => route.getDirections(d, nodes, searchableRooms));

  const handleStartWalking = () => {
    if (!directions?.path) return;
    jumpToSearchResult(directions.path[0]);
    setDirections(route.restartRoute);
    setPanelMode("directions"); // jumpToSearchResult closes the panel — reopen it for the route in progress
  };

  const handleWalkToNextStop = () => {
    const step = route.nextStep(directions, hotspots);
    if (step) goTo(step.id, { yaw: step.yaw });
  };
  useAutoWalk(directions, setDirections, handleWalkToNextStop);

  // Mobile-only: the bottom Building selector doubles as direct navigation
  // (there's no separate entrances list to browse on mobile) — picking a
  // building jumps straight to its first entrance.
  const handleMobileBuildingPick = (b) => {
    setBuildingFilter(b);
    setBuildingMenuOpen(false);
    if (b === "all") return;
    const entrance = pickDefaultEntranceForBuilding(nodes, b);
    if (entrance) jumpToSearchResult(entrance.id);
  };

  if (loadError) {
    return (
      <div className="main-page-status">
        <h2>ARISE</h2>
        <p>{loadError}</p>
        <p className="empty-hint">
          {loadError.includes("permission")
            ? "This usually means you're not signed in, or your account hasn't been approved yet."
            : "If this persists, check that the API (Arise_API) is running and reachable, and that its database has campus data."}
        </p>
      </div>
    );
  }

  if (!nodes) {
    return <LoadingScreen show label="Loading campus…" />;
  }

  const photoUrl = securePhotoUrl || "";
  const { arrived, nextStopId, nextStopName, turnInstruction } = route.routeProgress(directions, {
    byId,
    hotspots,
    entryYaw,
  });
  const autoWalking = directions?.autoWalking ?? false;

  // The kiosk dialog takes over the top of the panorama, so the node name
  // (and the menu button, whose actions would open a second dialog) step aside.
  const kioskDialogOpen = isMobile && (panelMode === "search" || (panelMode === "directions" && !!directions) || showFeedback);

  // Show the person's actual name, not their email — falls back to email
  // only if they skipped the optional name field at registration.
  const displayName = profile?.name || user?.email || "";
  const initials = displayName
    ? displayName.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  // Mobile/kiosk radial menu items — icon-only, fanned out around the
  // FAB (see .mobile-radial-menu). Each opens its own centered modal,
  // same pattern as FeedbackPanel, except Back, which is an immediate
  // action with nothing to show. Every handler collapses the radial menu
  // itself first (setMobileDockOpen(false)) so only the modal (or,
  // for Back, the panorama) is left showing, not both stacked at once.
  const radialItems = [
    history.length > 0 && { key: "back", icon: "←", title: "Back", onClick: goBack },
    {
      key: "search",
      icon: "🔍",
      title: "Search",
      onClick: () => { setMobileDockOpen(false); setPanelMode("search"); },
    },
    {
      key: "exit",
      icon: "🚨",
      title: "Nearest exit",
      onClick: () => { setMobileDockOpen(false); openDirectionsToNearestExit(); },
      className: "mobile-exit-btn",
    },
    {
      key: "feedback",
      icon: "💬",
      title: "Give feedback",
      onClick: () => { setMobileDockOpen(false); setShowFeedback(true); },
    },
    {
      key: "building",
      icon: "🏢",
      title: "Choose a building",
      onClick: () => { setMobileDockOpen(false); setBuildingMenuOpen(true); },
    },
    user && {
      key: "account",
      icon: initials,
      title: displayName,
      onClick: () => { setMobileDockOpen(false); setPanelMode("account"); },
      className: "mobile-account-btn",
    },
  ].filter(Boolean);

  const searchResultsContent = (
    <>
      {!searchQuery.trim() && randomSuggestions.length > 0 && (
        <div className="room-search-results">
          <p className="room-search-suggestions-label">Suggested rooms — click to view, or start typing to search</p>
          {randomSuggestions.map((r) => (
            <div key={r.roomName} className="room-search-result-actionable">
              <div className="room-search-result-main" onMouseDown={(e) => { e.preventDefault(); openRoomCard(r); }}>
                <span className="room-search-name">{r.roomName}</span>
                <span className="room-search-sub">
                  {r.placard.use ? `${r.placard.use} · ` : ""}
                  {buildingLabel(r.node.building)} · {floorLabel(r.node.floor)}
                </span>
              </div>
              <button
                type="button"
                className="directions-btn"
                onMouseDown={(e) => { e.preventDefault(); openDirectionsTo(r.node); }}
                title="Get directions"
              >
                ➜ Directions
              </button>
            </div>
          ))}
        </div>
      )}
      {(roomResults.length > 0 || placeResults.length > 0) && (
        <div className="room-search-results">
          {roomResults.length > 0 && (
            <>
              <p className="room-search-suggestions-label">Rooms</p>
              {roomResults.map((r) => (
                <div key={r.roomName} className="room-search-result-actionable">
                  <div className="room-search-result-main" onMouseDown={(e) => { e.preventDefault(); openRoomCard(r); }}>
                    <span className="room-search-name">{r.roomName}</span>
                    <span className="room-search-sub">
                      {r.placard.use ? `${r.placard.use} · ` : ""}
                      {buildingLabel(r.node.building)} · {floorLabel(r.node.floor)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="directions-btn"
                    onMouseDown={(e) => { e.preventDefault(); openDirectionsTo(r.node); }}
                    title="Get directions"
                  >
                    ➜ Directions
                  </button>
                </div>
              ))}
            </>
          )}
          {placeResults.length > 0 && (
            <>
              <p className="room-search-suggestions-label">Places</p>
              {placeResults.map((n) => (
                <div key={n.id} className="room-search-result-actionable">
                  <div className="room-search-result-main" onMouseDown={(e) => { e.preventDefault(); jumpToSearchResult(n.id); }}>
                    <span className="room-search-name">{n.name}</span>
                    <span className="room-search-sub">
                      {n.rooms?.length ? `Rooms: ${n.rooms.join(", ")} · ` : ""}
                      {buildingLabel(n.building)} · {floorLabel(n.floor)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="directions-btn"
                    onMouseDown={(e) => { e.preventDefault(); openDirectionsTo(n); }}
                    title="Get directions"
                  >
                    ➜ Directions
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
      {searchQuery.trim() && roomResults.length === 0 && placeResults.length === 0 && (
        <div className="room-search-results">
          <p className="empty-hint">No room or place found for "{searchQuery}".</p>
        </div>
      )}
    </>
  );

  // Shared between the From and To dropdowns — same "rooms first, places
  // second" structure as the main search bar, just parameterized by which
  // field is currently being edited.
  const renderDirectionsSuggestions = (field) => {
    if (directions?.editingField !== field) return null;
    if (directionsRoomMatches.length === 0 && directionsPlaceMatches.length === 0) return null;
    return (
      <div className="room-search-results directions-suggestions">
        {directionsRoomMatches.length > 0 && (
          <>
            <p className="room-search-suggestions-label">Rooms</p>
            {directionsRoomMatches.map((r) => (
              <div key={r.roomName} className="room-search-result" onClick={() => pickDirectionsFieldRoom(field, r)}>
                <span className="room-search-name">{r.roomName}</span>
                <span className="room-search-sub">
                  {r.placard.use ? `${r.placard.use} · ` : ""}
                  {buildingLabel(r.node.building)} · {floorLabel(r.node.floor)}
                </span>
              </div>
            ))}
          </>
        )}
        {directionsPlaceMatches.length > 0 && (
          <>
            <p className="room-search-suggestions-label">Places</p>
            {directionsPlaceMatches.map((n) => (
              <div key={n.id} className="room-search-result" onClick={() => pickDirectionsField(field, n)}>
                <span className="room-search-name">{n.name}</span>
                <span className="room-search-sub">{buildingLabel(n.building)} · {floorLabel(n.floor)}</span>
              </div>
            ))}
          </>
        )}
      </div>
    );
  };

  const directionsContent = directions && (
    <>
      <div className="directions-panel-header">
        <h3>{directions.kind === "exit" ? "🚨 Nearest Exit" : "Directions"}</h3>
        {!isMobile && <button className="close-btn" onClick={closeDirections}>✕</button>}
      </div>

      <label className="sidebar-field-label">
        From
        <input
          type="text"
          value={directions.fromQuery}
          onChange={(e) => updateDirectionsField("from", e.target.value)}
          onFocus={() => setDirections((d) => route.focusField(d, "from"))}
          inputMode={isMobile ? "none" : undefined}
          placeholder="Starting point"
        />
      </label>
      {renderDirectionsSuggestions("from")}

      <label className="sidebar-field-label">
        To
        <input
          type="text"
          value={directions.toQuery}
          onChange={(e) => updateDirectionsField("to", e.target.value)}
          onFocus={() => setDirections((d) => route.focusField(d, "to"))}
          inputMode={isMobile ? "none" : undefined}
          placeholder="Destination"
        />
      </label>
      {renderDirectionsSuggestions("to")}

      {directions.error && <p className="directions-error">{directions.error}</p>}

      {!directions.path && (
        <button className="primary directions-go-btn" onClick={handleGetDirections}>Get directions</button>
      )}

      {directions.path && !arrived && (
        <div className="directions-progress">
          <p className="directions-progress-text">
            Stop {directions.stepIndex + 1} of {directions.path.length}
            {nextStopName && (
              <>
                {" — "}
                {turnInstruction ? (
                  <><strong>{turnInstruction}</strong> {nextStopName}</>
                ) : (
                  <>next: <strong>{nextStopName}</strong></>
                )}
              </>
            )}
          </p>
          {directions.stepIndex === 0 && currentId !== directions.path[0] ? (
            <button className="primary directions-go-btn" onClick={handleStartWalking}>Start walking</button>
          ) : (
            <>
              <button
                className="primary directions-go-btn"
                onClick={handleWalkToNextStop}
                disabled={autoWalking}
              >
                Walk to {nextStopName} →
              </button>
              <button
                className="directions-go-btn directions-autowalk-btn"
                onClick={() => setDirections(route.toggleAutoWalk)}
              >
                {autoWalking ? "⏸ Stop auto-walk" : "▶ Auto-walk (every 5s)"}
              </button>
            </>
          )}
          <p className="field-hint">Or just click the glowing arrow in the photo.</p>
        </div>
      )}

      {directions.path && arrived && (
        <div className="directions-progress">
          <p className="directions-progress-text">🎉 You've arrived at <strong>{directions.toQuery}</strong>.</p>
          <button onClick={closeDirections}>Done</button>
        </div>
      )}
    </>
  );

  return (
    <div className="main-page-layout">
      {/* Overlays everything below until the current node's photo has
          actually finished decoding, not just until nodes data has
          loaded — matches how the !nodes early-return above already
          shows the same LoadingScreen for the initial data-fetch phase,
          this is just the continuation of that same splash into the
          photo-decode phase. Latches via initialLoadDone so it never
          reappears once shown, unlike .photo-transition-indicator below
          (still there, unchanged) which DOES reappear on every
          subsequent walk to a new node — that's the existing, correct
          behavior for ordinary navigation; this is specifically a
          first-load-only splash. */}
      <LoadingScreen show={!initialLoadDone} label="Loading campus…" />
      <div className="main-page-viewer">
        {!current ? (
          <div className="main-page-status">
            <p>No campus locations available yet.</p>
          </div>
        ) : isMobile ? (
          <div className="main-page-screen mobile-screen">
            <div
              className="mobile-panorama-frame"
              style={{ top: `${KIOSK_TOP_INSET * 100}%`, bottom: `${KIOSK_BOTTOM_INSET * 100}%` }}
            >
              {initialLoadDone && !photoReady && <div className="photo-transition-indicator">Loading…</div>}
              <PanoramaNav
                sceneKey={current.id}
                url={photoUrl}
                hotspots={hotspots}
                markers={markers}
                onNavigate={goTo}
                onRoomMarkerClick={handleRoomMarkerClick}
                onError={() => {}}
                placing={false}
                onPlaceAngle={() => {}}
                initialYaw={entryYaw}
                highlightedId={nextStopId}
                emergencyMode={directions?.kind === "exit"}
                heightFraction={KIOSK_PANORAMA_FRACTION}
              />
            </div>

            {/* ---------- Top: read-only location title only — no buttons up
                here. Every actionable control (search, back, exit,
                feedback, account, building picker) lives behind the
                middle-right FAB instead (see "Middle-right control dock"
                below), within arm's reach of someone standing at a
                wall-mounted kiosk, not up in the top corners. Safe-area
                padded (see CSS) so it clears a notch or kiosk bezel. ---------- */}
            {!kioskDialogOpen && (
            <div
              className="mobile-title-wrap"
              style={{ top: `calc(${KIOSK_TOP_INSET * 100}% + 12px)` }}
            >
              <div className="mobile-title-pill">
                <span>{current.name}</span>
              </div>
            </div>
            )}

            {showMinimap && (
              <CrossCampusMinimap
                lat={currentBuildingMeta.lat}
                lng={currentBuildingMeta.lng}
                label={buildingLabel(current.building)}
                className="minimap-widget-mobile"
              />
            )}

            {mobileDockOpen && (
              <div className="mobile-panel-backdrop" onClick={closeMobileDock} />
            )}

            {/* ---------- Room card: still a draggable bottom sheet — the
                other panels below all became centered modals instead
                (see the "Mobile modals" comment further down), but this
                one's peek/half/full drag gesture is its own established
                feature, unaffected by any of that. ---------- */}
            {panelMode === "room" && selectedRoomCard && (
              <MobileRoomSheet
                room={selectedRoomCard}
                onClose={closeRoomCard}
                onGetDirections={handleRoomGetDirections}
                onView360={handleRoomView360}
              />
            )}

            {/* ---------- Middle-right control dock: a single FAB, collapsed
                by default — reachable at arm's length by someone standing
                at a wall-mounted kiosk. Tapping it fans icon-only buttons
                out around it, clock-numbers style, swept across its right
                side (see radialButtonTransform); tapping it again (or the
                backdrop, or Escape) collapses it. Every icon opens its own
                centered modal below except Back, an immediate action.
                Hidden entirely while the room sheet already has the
                visitor's attention. ---------- */}
            {panelMode !== "room" && !kioskDialogOpen && (
              <div className="mobile-side-dock">
                <button
                  type="button"
                  className="mobile-side-fab"
                  onClick={() => (mobileDockOpen ? closeMobileDock() : setMobileDockOpen(true))}
                  aria-label={mobileDockOpen ? "Close menu" : "Open menu"}
                  aria-expanded={mobileDockOpen}
                  title={mobileDockOpen ? "Close menu" : "Menu"}
                >
                  {mobileDockOpen ? "✕" : "☰"}
                </button>

                {mobileDockOpen && (
                  <div className="mobile-radial-menu">
                    {radialItems.map((item, i) => (
                      <button
                        key={item.key}
                        type="button"
                        className={"mobile-radial-btn" + (item.className ? ` ${item.className}` : "")}
                        style={{ transform: radialButtonTransform(i, radialItems.length) }}
                        onClick={item.onClick}
                        title={item.title}
                        aria-label={item.title}
                      >
                        {item.icon}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ---------- Mobile dialogs. Search and directions/exit (and
                feedback, below) are the keyboard modules: they share the
                KioskDialog grid. Account and the Building picker have no
                text entry and stay small centered .modal-overlay/.modal
                boxes, auto-sized to their own content. ---------- */}
            {panelMode === "search" && (
              <KioskDialog title="Search" onClose={closePanel}>
                <div className="mobile-search-row">
                  <input
                    ref={searchInputRef}
                    type="text"
                    inputMode="none"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={current?.name || "Search a room..."}
                    aria-label="Search"
                    autoFocus
                  />
                </div>
                {/* Fills whatever height the dialog has left below the field,
                    scrolling on its own — see .kiosk-dialog .mobile-search-results-area. */}
                <div className="mobile-search-results-area">
                  {searchResultsContent}
                </div>
              </KioskDialog>
            )}

            {panelMode === "directions" && directions && (
              <KioskDialog onClose={closeDirections}>
                <div className="directions-panel">
                  {directionsContent}
                </div>
              </KioskDialog>
            )}

            {panelMode === "account" && user && (
              <div className="modal-overlay" onClick={closePanel}>
                <div className="modal mobile-account-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="preview-header">
                    <h3>Account</h3>
                    <button className="close-btn" onClick={closePanel}>✕</button>
                  </div>
                  <div className="mobile-account-panel">
                    <div className="account-avatar">{initials}</div>
                    <span className="account-name" title={displayName}>{displayName}</span>
                    {role === "admin" && (
                      <Link to="/admin" className="sidebar-admin-btn">🛠 Admin Panel</Link>
                    )}
                    <button onClick={signOut} className="subtle account-signout mobile-signout-btn">Sign out</button>
                  </div>
                </div>
              </div>
            )}

            {buildingMenuOpen && (
              <div className="modal-overlay" onClick={() => setBuildingMenuOpen(false)}>
                <div className="modal mobile-building-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="preview-header">
                    <h3>Choose a building</h3>
                    <button className="close-btn" onClick={() => setBuildingMenuOpen(false)}>✕</button>
                  </div>
                  <div className="mobile-building-list">
                    <button
                      type="button"
                      className={"mobile-building-option" + (buildingFilter === "all" ? " mobile-building-option-active" : "")}
                      onClick={() => handleMobileBuildingPick("all")}
                    >
                      All Buildings
                    </button>
                    {allBuildings().map((b) => (
                      <button
                        type="button"
                        key={b.id}
                        className={"mobile-building-option" + (buildingFilter === b.id ? " mobile-building-option-active" : "")}
                        onClick={() => handleMobileBuildingPick(b.id)}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="main-page-screen">
              {initialLoadDone && !photoReady && <div className="photo-transition-indicator">Loading…</div>}
              <PanoramaNav
                sceneKey={current.id}
                url={photoUrl}
                hotspots={hotspots}
                markers={markers}
                onNavigate={goTo}
                onRoomMarkerClick={handleRoomMarkerClick}
                onError={() => {}}
                placing={false}
                onPlaceAngle={() => {}}
                initialYaw={entryYaw}
                highlightedId={nextStopId}
                emergencyMode={directions?.kind === "exit"}
              />

              <div className="floating-title-wrap">
                <div className="floating-title-pill">
                  {history.length > 0 && (
                    <button className="floating-title-back" onClick={goBack} title="Back">←</button>
                  )}
                  <span>{current.name}</span>
                </div>
              </div>

              {showMinimap && (
                <CrossCampusMinimap
                  lat={currentBuildingMeta.lat}
                  lng={currentBuildingMeta.lng}
                  label={buildingLabel(current.building)}
                  className="minimap-widget-desktop"
                />
              )}

              {/* Floating overlay UI — rail, search bar, and the single
                  floating panel — all positioned over the panorama itself,
                  Maps-style, rather than pushing it aside. */}
              <div className="floating-rail">
                <button className="floating-rail-btn" onClick={toggleMenu} title="Menu">☰</button>
                <div className="floating-rail-spacer" />
              </div>

              {/* Moved out of the rail — fixed position, stacked directly
                  ABOVE where the minimap sits (same left offset, just
                  above its top edge) rather than beside it at the same
                  height. Position stays fixed regardless of whether the
                  minimap is actually showing right now — a safety button
                  shouldn't jump around based on unrelated state. */}
              <button
                className="floating-rail-btn floating-exit-btn floating-exit-btn-stacked"
                onClick={openDirectionsToNearestExit}
                title="Find the nearest exit"
              >
                🚨
              </button>

              {/* Client-requested: bottom-left, alongside the exit
                  button — same stacking convention (same left offset,
                  positioned just above the element below it), one more
                  step up from the exit button. */}
              <button
                className="floating-rail-btn floating-feedback-btn"
                onClick={() => setShowFeedback(true)}
                title="Give feedback"
              >
                💬
              </button>

              {/* Moved out of the rail and up to the top-right — its own
                  popover now needs to open DOWNWARD instead of upward
                  (see .floating-account-wrap-top override), since it's no
                  longer sitting at the bottom of the screen where opening
                  upward made sense. */}
              {/* Hidden entirely for a logged-out visitor — same
                  reasoning as the mobile account button above. */}
              {user && (
                <div className="floating-account-wrap floating-account-wrap-top" ref={accountMenuRef}>
                  {accountMenuOpen && (
                    <div className="account-popover">
                      <span className="account-popover-name" title={displayName}>{displayName}</span>
                      {role === "admin" && (
                        <Link to="/admin" className="sidebar-admin-btn">🛠 Admin Panel</Link>
                      )}
                      <button onClick={signOut} className="subtle account-signout">Sign out</button>
                    </div>
                  )}
                  <button
                    className="floating-rail-btn floating-account-btn"
                    onClick={() => setAccountMenuOpen((o) => !o)}
                    title={displayName}
                  >
                    {initials}
                  </button>
                </div>
              )}

              <div className="floating-search-wrap">
                <div className="floating-search-bar">
                  <input
                    ref={searchInputRef}
                    type="text"
                    inputMode="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setPanelMode("search")}
                    onBlur={() => setPanelMode((m) => (m === "search" ? null : m))}
                    placeholder="Search a room..."
                    aria-label="Search"
                  />
                  <span className="floating-search-icon">🔍</span>
                </div>
              </div>

              {panelMode && (
                <>
                  <div className="floating-panel-backdrop" />
                  <div className="floating-panel">
                    {panelMode === "search" && (
                      <>
                        {searchResultsContent}
                      </>
                    )}

                    {panelMode === "menu" && (
                      <div className="sidebar-card">
                        <label className="sidebar-field-label">
                          Building
                          <select value={buildingFilter} onChange={(e) => setBuildingFilter(e.target.value)}>
                            <option value="all">All Buildings</option>
                            {allBuildings().map((b) => (
                              <option key={b.id} value={b.id}>{b.label}</option>
                            ))}
                          </select>
                        </label>

                        <div className="sidebar-entrances">
                          <h3 className="sidebar-subheading">Entrances</h3>
                          {entrances.length === 0 && (
                            <p className="empty-hint">No entrances found for this building yet.</p>
                          )}
                          <div className="entrance-list">
                            {entrances.map((e) => (
                              <button
                                key={e.id}
                                className={"entrance-btn" + (e.id === currentId ? " active" : "")}
                                onClick={() => jumpToSearchResult(e.id)}
                              >
                                {e.name}
                                <span className="entrance-btn-sub">{buildingLabel(e.building)} · {floorLabel(e.floor)}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {panelMode === "room" && selectedRoomCard && (
                      <RoomCard
                        room={selectedRoomCard}
                        onClose={closeRoomCard}
                        onGetDirections={handleRoomGetDirections}
                        onView360={handleRoomView360}
                      />
                    )}

                    {panelMode === "directions" && directions && (
                      <div className="directions-panel">
                        {directionsContent}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
        )}
      </div>

      {room360Open && selectedRoomCard && (
        <Room360Modal
          roomName={selectedRoomCard.roomName}
          photo360={selectedRoomCard.placard?.photo360}
          onClose={() => setRoom360Open(false)}
        />
      )}

      {flyover && (
        <FlyoverPanel flyover={flyover} onComplete={completeFlyover} onCancel={cancelFlyover} />
      )}

      {showFeedback && (
        <FeedbackPanel onClose={() => setShowFeedback(false)} kiosk={isMobile} />
      )}

      {isIdle && (
        <IdlePrompt
          onContinue={resetIdle}
          onGiveFeedback={() => {
            resetIdle();
            setShowFeedback(true);
          }}
        />
      )}
    </div>
  );
}
