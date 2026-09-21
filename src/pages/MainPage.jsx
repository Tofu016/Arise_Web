import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import PanoramaNav from "../components/PanoramaNav";
import LoadingScreen from "../components/LoadingScreen";
import RoomCard from "../components/RoomCard";
import Room360Modal from "../components/Room360Modal";
import CrossCampusMinimap from "../components/CrossCampusMinimap";
import FlyoverPanel from "../components/FlyoverPanel";
import KioskRoomCard from "../components/KioskRoomCard";
import KioskStartScreen from "../components/KioskStartScreen";
import KioskBuildingScreen from "../components/KioskBuildingScreen";
import KioskDialog from "../components/KioskDialog";
import KioskWalkBar from "../components/KioskWalkBar";
import AutoWalkCountdown from "../components/AutoWalkCountdown";
import ArrivalModal from "../components/ArrivalModal";
import FeedbackPanel from "../components/FeedbackPanel";
import IdlePrompt from "../components/IdlePrompt";
import { useIdleDetector } from "../hooks/useIdleDetector";
import { useOverlay } from "../hooks/useOverlay";
import { useCompactLayout } from "../hooks/useCompactLayout";
import { useKioskSession, useKioskZoomLock } from "../hooks/useKioskSession";
import { blocksIdle, coverage } from "../utils/overlay";
import { allBuildings, buildingLabel, floorLabel } from "../utils/constants";
import { buildHotspots } from "../utils/hotspots";
import { useCustomBuildingsVersion } from "../utils/buildingStore";
import { buildSearchableRooms, findRoomForMarker, pickSuggestions, searchCampus } from "../utils/search";
import { pickBuildingStart, pickFloorStart } from "../utils/navigation";
import { useNavigation } from "../hooks/useNavigation";
import { useDirectionsFlow } from "../hooks/useDirectionsFlow";
import { AUTO_WALK_STEP_SECONDS } from "../hooks/useDirections";
import { usePublicNodes } from "../hooks/usePublicNodes";
import { useNodePhoto } from "../hooks/useNodePhoto";
import { KIOSK_TOP_INSET, KIOSK_BOTTOM_INSET, KIOSK_PANORAMA_FRACTION, KIOSK_CARD_CENTER, KIOSK_RAISED_STYLE } from "../utils/kioskLayout";
import { usePlacardDialogs } from "../hooks/usePlacardDialogs";
import { useAuth } from "../context/useAuth";

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

// Kiosk: finishing feedback resets the whole system to the start screen and
// starting node. Remounting the page under a fresh key drops every piece of
// visitor state at once (position, history, panels, route, start screen).
export default function MainPage() {
  const [session, setSession] = useState(0);
  return <MainPageContent key={session} onReset={() => setSession((s) => s + 1)} />;
}

function MainPageContent({ onReset }) {
  useCustomBuildingsVersion(); // pick up admin-created buildings without a reload
  const { user, profile, role, signOut } = useAuth();
  const compact = useCompactLayout();
  // Kiosk session: the attract screen, then the building screen, then
  // exploring — see utils/kioskSession.js. Desktop skips straight to exploring.
  const kiosk = useKioskSession(compact);
  useKioskZoomLock(compact);

  const { nodes, error: loadError } = usePublicNodes();
  const [buildingFilter, setBuildingFilter] = useState("all");

  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef(null);

  // What's on screen over the panorama — the floating panel, the mobile/kiosk
  // dock, feedback, a room's 360 view, the building dialog, the walk bar —
  // lives in one module; see utils/overlay.js. Blurring the search input
  // (blurSearch) deliberately does NOT collapse the dock: that fires on every
  // incidental focus change within the panel and would yank it away
  // mid-interaction.
  const overlay = useOverlay();
  const {
    panel: panelMode,
    dock: mobileDockOpen,
    feedback: showFeedback,
    room360: room360Open,
    buildingMenu: buildingMenuOpen,
    floorPick: floorPickBuilding,
    roomCard: selectedRoomCard,
  } = overlay;

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

  const byId = useMemo(() => Object.fromEntries((nodes || []).map((n) => [n.id, n])), [nodes]);

  // Where the visitor is standing, their history, and any cross-campus
  // flyover in progress — see utils/navigation.js.
  const nav = useNavigation(nodes, byId);
  const { currentId, history, entryYaw, flyover } = nav;

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
  // Also off while the kiosk's start/building screens are up — nobody is
  // exploring yet, so "Done exploring?" would make no sense there.
  const idleDetectorEnabled =
    !blocksIdle(overlay, { flyover, awaitingStart: kiosk.awaitingStart });
  const [isIdle, resetIdle] = useIdleDetector(IDLE_TIMEOUT_MS, idleDetectorEnabled);

  const hotspots = useMemo(
    () => (current ? buildHotspots(current, byId, { withPhoto: true }) : []),
    [current, byId]
  );

  const markers = current?.markers || [];

  // What follows a move that actually happened — everything the navigation
  // module deliberately knows nothing about: the search box (the overlay
  // module handles the panel, dock and room card).
  const afterMove = (action) => {
    overlay.moved({ type: action.type, room: action.meta?.room });
    if (action.type !== "back") setSearchQuery("");
  };

  // Hotspot click, and "Walk to next stop" in directions.
  const goTo = (id, angle) => {
    const { outcome, action } = nav.walk(id, angle?.yaw);
    if (outcome === "ignored") return;
    if (outcome === "moved") afterMove(action);
    else overlay.heldForFlyover();
  };

  const goBack = () => {
    const { outcome, action } = nav.back();
    if (outcome === "ignored") return;
    if (outcome === "moved") afterMove(action);
    else overlay.heldForFlyover();
  };

  // Jumping in from search/an entrance/directions/a room card is a fresh
  // start, not a "walk from where I was" — there's no path shown yet, just a
  // direct hop. Also dismisses whatever the floating panel was showing, same
  // as Maps closing search/place-details once you actually navigate somewhere.
  // Every cross-campus move gets a flyover first, this included.
  const jumpToSearchResult = (id, meta) => {
    const { outcome, action } = nav.jump(id, meta);
    if (outcome === "ignored") return;
    if (outcome === "moved") afterMove(action);
    else overlay.heldForFlyover({ closePanel: true }); // the hop itself is deferred, the panel is not
  };

  // Called once the flyover sequence finishes (auto-proceed or Skip).
  const completeFlyover = () => {
    const { action } = nav.completeFlyover();
    if (action) afterMove(action);
  };

  // Cancelling just closes the flyover — the visitor stays exactly where
  // they already were, no move happens at all.
  const cancelFlyover = () => nav.cancelFlyover();

  // Directions ("just like Street View"): the from/to panel and the Route it
  // computes — see hooks/useDirectionsFlow.js. Called before any early
  // return, since it's a hook.
  const flow = useDirectionsFlow({
    nodes,
    current,
    currentId,
    byId,
    entryYaw,
    hotspots,
    searchableRooms,
    moves: { jump: jumpToSearchResult, walk: goTo },
    overlay,
    clearSearch: () => setSearchQuery(""),
  });
  const { directions, progress, suggestions } = flow;

  // Called unconditionally here (before any early returns below) since it's a
  // hook. `ready` covers "no photo at all" too, so the splash can't stick when
  // zero nodes are configured; `firstLoadDone` latches for the full-screen
  // splash only — later moves use the small .photo-transition-indicator.
  const {
    url: photoUrl,
    ready: photoReady,
    firstLoadDone: initialLoadDone,
  } = useNodePhoto(current, {
    neighbors: hotspots,
    priorityId: progress.nextStopId,
    nodesLoaded: !!nodes,
  });

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

  const handleRoomGetDirections = () => {
    if (!selectedRoomCard) return;
    flow.openTo(selectedRoomCard.node);
  };

  // Opens the room's OWN photo360 (set via the "360° room photo" field in
  // Room Edit) as a standalone viewer. The button is disabled in RoomCard
  // when no photo360 is set, so this can assume one exists.
  const handleRoomView360 = () => {
    if (!selectedRoomCard?.placard?.photo360) return;
    overlay.openRoom360();
  };

  // Mobile-only: the bottom Building selector doubles as direct navigation
  // (there's no separate entrances list to browse on mobile) — picking a
  // building jumps straight to its first entrance.
  const handleMobileBuildingPick = (b) => {
    setBuildingFilter(b);
    overlay.closeBuildingMenu();
    if (b === "all") return;
    const start = pickBuildingStart(nodes, b);
    if (start) jumpToSearchResult(start.id);
  };

  // Building dialog, floor step: land on that floor's starting node.
  const handleMobileFloorPick = (buildingId, floor) => {
    const start = pickFloorStart(nodes, buildingId, floor);
    setBuildingFilter(buildingId);
    overlay.closeBuildingMenu();
    if (start && start.id !== currentId) jumpToSearchResult(start.id);
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
    // The kiosk start screen covers the initial data load too, so the
    // loading screen never shows before it.
    return (
      <>
        <LoadingScreen show label="Loading campus…" />
        {compact && <KioskStartScreen hidden={kiosk.stage !== "start"} onStart={kiosk.start} />}
      </>
    );
  }

  const { arrived, nextStopId, nextStopName, turnInstruction, walkStarted } = progress;
  const autoWalking = directions?.autoWalking ?? false;

  // Kiosk: once the route is actually being walked (the visitor is at its
  // start, and hasn't arrived), the big directions dialog steps aside for the
  // compact KioskWalkBar, so the panorama stays visible. `overlay.walkDialog`
  // brings the big dialog back on request.
  const { walkBarShown, kioskDialogOpen, coversPanorama } = coverage(overlay, {
    compact,
    directions,
    arrived,
    walkStarted,
    flyover,
  });
  // The idle prompt covers the panorama too, so it hides the hotspot previews as well.
  const overlayOpen = coversPanorama || isIdle;

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
  // itself first (openFromDock) so only the modal (or,
  // for Back, the panorama) is left showing, not both stacked at once.
  const radialItems = [
    history.length > 0 && { key: "back", icon: "←", title: "Back", onClick: goBack },
    {
      key: "search",
      icon: "🔍",
      title: "Search",
      onClick: () => overlay.openFromDock("search"),
    },
    {
      key: "exit",
      icon: "🧭",
      title: "Directions",
      onClick: flow.open, // also collapses the dock
    },
    {
      key: "feedback",
      icon: "💬",
      title: "Give feedback",
      onClick: () => overlay.openFromDock("feedback"),
    },
    {
      key: "building",
      icon: "🏢",
      title: "Choose a building",
      onClick: () => overlay.openFromDock("building"),
    },
    user && {
      key: "account",
      icon: initials,
      title: displayName,
      onClick: () => overlay.openFromDock("account"),
      className: "mobile-account-btn",
    },
  ].filter(Boolean);

  // The two actions on a search result. The entry itself isn't clickable —
  // "Go To" jumps there, "Directions" routes there. onMouseDown +
  // preventDefault keeps the search input focused (its blur closes the panel).
  const renderResultActions = (onGoTo, directionsNode) => (
    <div className="search-result-actions">
      <button
        type="button"
        className="directions-btn"
        onMouseDown={(e) => { e.preventDefault(); onGoTo(); }}
        title="Go to this location"
      >
        ⤳ Go To
      </button>
      <button
        type="button"
        className="directions-btn"
        onMouseDown={(e) => { e.preventDefault(); flow.openTo(directionsNode); }}
        title="Get directions"
      >
        ➜ Directions
      </button>
    </div>
  );

  const searchResultsContent = (
    <>
      {!searchQuery.trim() && randomSuggestions.length > 0 && (
        <div className="room-search-results">
          <p className="room-search-suggestions-label">Suggested rooms: use Go To or Directions, or start typing to search</p>
          {randomSuggestions.map((r) => (
            <div key={r.roomName} className="room-search-result-actionable">
              <div className="room-search-result-main">
                <span className="room-search-name">{r.roomName}</span>
                <span className="room-search-sub">
                  {r.placard.use ? `${r.placard.use} · ` : ""}
                  {buildingLabel(r.node.building)} · {floorLabel(r.node.floor)}
                </span>
              </div>
              {renderResultActions(() => openRoomCard(r), r.node)}
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
                  <div className="room-search-result-main">
                    <span className="room-search-name">{r.roomName}</span>
                    <span className="room-search-sub">
                      {r.placard.use ? `${r.placard.use} · ` : ""}
                      {buildingLabel(r.node.building)} · {floorLabel(r.node.floor)}
                    </span>
                  </div>
                  {renderResultActions(() => openRoomCard(r), r.node)}
                </div>
              ))}
            </>
          )}
          {placeResults.length > 0 && (
            <>
              <p className="room-search-suggestions-label">Places</p>
              {placeResults.map((n) => (
                <div key={n.id} className="room-search-result-actionable">
                  <div className="room-search-result-main">
                    <span className="room-search-name">{n.name}</span>
                    <span className="room-search-sub">
                      {n.rooms?.length ? `Rooms: ${n.rooms.join(", ")} · ` : ""}
                      {buildingLabel(n.building)} · {floorLabel(n.floor)}
                    </span>
                  </div>
                  {renderResultActions(() => jumpToSearchResult(n.id), n)}
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
    if (suggestions.rooms.length === 0 && suggestions.places.length === 0) return null;
    return (
      <div className="room-search-results directions-suggestions">
        {suggestions.rooms.length > 0 && (
          <>
            <p className="room-search-suggestions-label">Rooms</p>
            {suggestions.rooms.map((r) => (
              <div key={r.roomName} className="room-search-result" onClick={() => flow.pickRoom(field, r)}>
                <span className="room-search-name">{r.roomName}</span>
                <span className="room-search-sub">
                  {r.placard.use ? `${r.placard.use} · ` : ""}
                  {buildingLabel(r.node.building)} · {floorLabel(r.node.floor)}
                </span>
              </div>
            ))}
          </>
        )}
        {suggestions.places.length > 0 && (
          <>
            <p className="room-search-suggestions-label">Places</p>
            {suggestions.places.map((n) => (
              <div key={n.id} className="room-search-result" onClick={() => flow.pickNode(field, n)}>
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
        <h3>Directions</h3>
        {!compact && <button className="close-btn" onClick={flow.close}>✕</button>}
      </div>

      <label className="sidebar-field-label">
        From
        <input
          type="text"
          value={directions.fromQuery}
          onChange={(e) => flow.editField("from", e.target.value)}
          onFocus={() => flow.focusField("from")}
          inputMode={compact ? "none" : undefined}
          placeholder="Starting point"
        />
      </label>
      {renderDirectionsSuggestions("from")}

      <label className="sidebar-field-label">
        To
        <input
          type="text"
          value={directions.toQuery}
          onChange={(e) => flow.editField("to", e.target.value)}
          onFocus={() => flow.focusField("to")}
          inputMode={compact ? "none" : undefined}
          placeholder="Destination"
        />
      </label>
      {renderDirectionsSuggestions("to")}

      {directions.error && <p className="directions-error">{directions.error}</p>}

      {!directions.path && (
        <button className="primary directions-go-btn" onClick={flow.get}>Get directions</button>
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
            <button className="primary directions-go-btn" onClick={() => flow.startWalking()}>Start walking</button>
          ) : (
            <>
              <button
                className="primary directions-go-btn"
                onClick={() => { overlay.setWalkDialog(false); flow.walkToNext(); }}
                disabled={autoWalking}
              >
                Walk to {nextStopName} →
              </button>
              <button
                className="directions-go-btn directions-autowalk-btn"
                onClick={() => { overlay.setWalkDialog(false); flow.toggleAutoWalk(); }}
              >
                {autoWalking ? "⏸ Stop auto-walk" : `▶ Auto-walk (every ${AUTO_WALK_STEP_SECONDS}s)`}
                {autoWalking && <AutoWalkCountdown key={directions.stepIndex} />}
              </button>
            </>
          )}
          <p className="field-hint">Follow the green hotspot in the photo — it marks the correct path to your destination.</p>
        </div>
      )}
    </>
  );

  return (
    <div className="main-page-layout">
      {directions?.path && arrived && <ArrivalModal kiosk={compact} onDone={flow.close} />}
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
      {compact && (
        <KioskBuildingScreen
          hidden={kiosk.stage === "exploring"}
          buildings={allBuildings()}
          available={new Set(nodes.map((n) => n.building))}
          onPick={(b) => {
            handleMobileBuildingPick(b);
            kiosk.chooseBuilding();
          }}
        />
      )}
      {compact && <KioskStartScreen hidden={kiosk.stage !== "start"} onStart={kiosk.start} />}
      <div className="main-page-viewer">
        {!current ? (
          <div className="main-page-status">
            <p>No campus locations available yet.</p>
          </div>
        ) : compact ? (
          <div className="main-page-screen mobile-screen">
            <div
              className="mobile-panorama-frame"
              style={{ top: `${KIOSK_TOP_INSET * 100}%`, bottom: `${KIOSK_BOTTOM_INSET * 100}%` }}
            >
              {/* Kiosk: a spinner in the middle of the panorama band, with the band dimmed
                  around it; the header and bottom whitespace aren't covered. */}
              {initialLoadDone && !photoReady && (
                <div className="kiosk-loading-overlay" role="status" aria-label="Loading">
                  <div className="loading-spinner" />
                </div>
              )}
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
                autoPan={!!nextStopId}
                heightFraction={KIOSK_PANORAMA_FRACTION}
                alwaysShowPreview
                zoomable
                previewsHidden={overlayOpen}
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
              <div className="mobile-panel-backdrop" onClick={overlay.dismiss} />
            )}

            {/* ---------- Room card: same footprint as the kiosk dialogs
                (top half of the panorama band), not a bottom sheet — the
                screen's very bottom sits at shin height. ---------- */}
            {panelMode === "room" && selectedRoomCard && (
              <KioskRoomCard
                room={selectedRoomCard}
                onClose={overlay.closeRoomCard}
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
                  onClick={() => (mobileDockOpen ? overlay.dismiss() : overlay.openDock())}
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
              <KioskDialog title="Search" onClose={overlay.closePanel}>
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

            {panelMode === "directions" && directions && !arrived && !walkBarShown && (
              <KioskDialog onClose={flow.close}>
                <div className="directions-panel">
                  {directionsContent}
                </div>
              </KioskDialog>
            )}

            {walkBarShown && (
              <KioskWalkBar
                progressText={`Stop ${directions.stepIndex + 1} of ${directions.path.length}${
                  turnInstruction ? ` — ${turnInstruction}` : ""
                }`}
                nextStopName={nextStopName}
                autoWalking={autoWalking}
                stepIndex={directions.stepIndex}
                onWalk={flow.walkToNext}
                onToggleAutoWalk={() => flow.toggleAutoWalk()}
                onShowDialog={() => overlay.setWalkDialog(true)}
              />
            )}

            {panelMode === "account" && user && (
              <div className="modal-overlay kiosk-raised-overlay" style={KIOSK_RAISED_STYLE} onClick={overlay.closePanel}>
                <div className="modal mobile-account-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="preview-header">
                    <h3>Account</h3>
                    <button className="close-btn" onClick={overlay.closePanel}>✕</button>
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
              <div
                className="modal-overlay mobile-building-overlay"
                style={{ paddingTop: `calc(${KIOSK_CARD_CENTER * 100}vh - 170px)` }}
                onClick={overlay.closeBuildingMenu}
              >
                <div className="modal mobile-building-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="preview-header">
                    <h3>Choose a building</h3>
                    <button className="close-btn" onClick={overlay.closeBuildingMenu}>✕</button>
                  </div>
                  <div className="mobile-building-list">
                    <button
                      type="button"
                      className={"mobile-building-option" + (buildingFilter === "all" ? " mobile-building-option-active" : "")}
                      onClick={() => handleMobileBuildingPick("all")}
                    >
                      All Buildings
                    </button>
                    {allBuildings().map((b) => {
                      const floors = [...new Set(nodes.filter((n) => n.building === b.id).map((n) => Number(n.floor)))].sort(
                        (x, y) => x - y
                      );
                      const expanded = floorPickBuilding === b.id;
                      return (
                        <div key={b.id}>
                          <button
                            type="button"
                            className={"mobile-building-option" + (buildingFilter === b.id || expanded ? " mobile-building-option-active" : "")}
                            disabled={floors.length === 0}
                            aria-expanded={expanded}
                            onClick={() => overlay.setFloorPick(expanded ? null : b.id)}
                          >
                            {b.label}
                          </button>
                          {expanded && (
                            <div className="mobile-floor-grid">
                              {floors.map((f) => (
                                <button
                                  key={f}
                                  type="button"
                                  className="mobile-floor-btn"
                                  onClick={() => handleMobileFloorPick(b.id, f)}
                                >
                                  {floorLabel(f)}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
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
                autoPan={!!nextStopId}
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
                <button className="floating-rail-btn" onClick={overlay.toggleMenu} title="Menu">☰</button>
                <div className="floating-rail-spacer" />
              </div>

              {/* Moved out of the rail — fixed position, stacked directly
                  ABOVE where the minimap sits (same left offset, just
                  above its top edge) rather than beside it at the same
                  height. Position stays fixed regardless of whether the
                  minimap is actually showing right now — a safety button
                  shouldn't jump around based on unrelated state. */}
              <button
                className="floating-rail-btn floating-exit-btn-stacked"
                onClick={flow.open}
                title="Get directions"
              >
                🧭
              </button>

              {/* Client-requested: bottom-left, alongside the exit
                  button — same stacking convention (same left offset,
                  positioned just above the element below it), one more
                  step up from the exit button. */}
              <button
                className="floating-rail-btn floating-feedback-btn"
                onClick={overlay.openFeedback}
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
                    onFocus={() => overlay.showPanel("search")}
                    onBlur={overlay.blurSearch}
                    placeholder="Search a room..."
                    aria-label="Search"
                  />
                  <span className="floating-search-icon">🔍</span>
                </div>
              </div>

              {panelMode && (
                <>
                  <div className="floating-panel-backdrop" />
                  <div className={"floating-panel" + (panelMode === "search" ? " floating-panel-search" : "")}>
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
                        onClose={overlay.closeRoomCard}
                        onGetDirections={handleRoomGetDirections}
                        onView360={handleRoomView360}
                      />
                    )}

                    {panelMode === "directions" && directions && !arrived && (
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
          onClose={overlay.closeRoom360}
        />
      )}

      {flyover && (
        <FlyoverPanel flyover={flyover} onComplete={completeFlyover} onCancel={cancelFlyover} />
      )}

      {showFeedback && (
        <FeedbackPanel onClose={overlay.closeFeedback} onFinished={onReset} kiosk={compact} />
      )}

      {isIdle && (
        <IdlePrompt
          onContinue={resetIdle}
          onStartOver={compact ? onReset : undefined}
          onGiveFeedback={() => {
            resetIdle();
            overlay.openFeedback();
          }}
        />
      )}
    </div>
  );
}
