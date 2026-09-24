import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import PanoramaNav from "../components/PanoramaNav";
import LoadingScreen from "../components/LoadingScreen";
import RoomCard from "../components/RoomCard";
import Room360Modal from "../components/Room360Modal";
import FlyoverPanel from "../components/FlyoverPanel";
import KioskRoomCard from "../components/KioskRoomCard";
import KioskStartScreen from "../components/KioskStartScreen";
import KioskCampusScreen from "../components/KioskCampusScreen";
import KioskBuildingScreen from "../components/KioskBuildingScreen";
import KioskFloorScreen from "../components/KioskFloorScreen";
import KioskDialog from "../components/KioskDialog";
import KioskWalkBar from "../components/KioskWalkBar";
import AutoWalkCountdown from "../components/AutoWalkCountdown";
import ArrivalModal from "../components/ArrivalModal";
import FeedbackPanel from "../components/FeedbackPanel";
import KioskThanks from "../components/KioskThanks";
import IdlePrompt from "../components/IdlePrompt";
import Coachmark from "../components/Coachmark";
import HelpModal from "../components/HelpModal";
import NearbyRoomsPanel from "../components/NearbyRoomsPanel";
import { useIdleDetector } from "../hooks/useIdleDetector";
import { useOnboardingHints } from "../hooks/useOnboardingHints";
import { useOverlay } from "../hooks/useOverlay";
import { useCompactLayout } from "../hooks/useCompactLayout";
import { useKioskSession, useKioskZoomLock } from "../hooks/useKioskSession";
import { blocksIdle, coverage } from "../utils/overlay";
import { allBuildings, buildingLabel, campusForBuilding, floorLabel } from "../utils/constants";
import { buildHotspots } from "../utils/hotspots";
import { useCustomBuildingsVersion } from "../utils/buildingStore";
import { buildSearchableRooms, findRoomForMarker, pickSuggestions, searchCampus } from "../utils/search";
import { findNearbyRooms } from "../utils/nearbyRooms";
import { elevatorDestinationsFrom, arrivalYawFromLanding } from "../utils/elevators";
import { speak } from "../utils/tts";
import {
  floorsForBuilding,
  findKioskEntranceShortcuts,
  findMainCampusEntrance,
  findCampusEntrance,
  buildingsForCampus,
} from "../utils/navigation";
import { useNavigation } from "../hooks/useNavigation";
import { useKioskPicks } from "../hooks/useKioskPicks";
import { useDirectionsFlow } from "../hooks/useDirectionsFlow";
import { AUTO_WALK_STEP_SECONDS } from "../hooks/useDirections";
import { usePublicNodes } from "../hooks/usePublicNodes";
import { useNodePhoto } from "../hooks/useNodePhoto";
import { KIOSK_TOP_INSET, KIOSK_BOTTOM_INSET, KIOSK_PANORAMA_FRACTION, KIOSK_CARD_CENTER, KIOSK_PANORAMA_CENTER, KIOSK_RAISED_STYLE } from "../utils/kioskLayout";
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
const RADIAL_RADIUS = 170;
const RADIAL_SPREAD_DEG = 170;

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
  // Kiosk session: the attract screen, then the campus screen, then (only
  // for a multi-building campus) the building screen, then the floor
  // screen, then exploring
  // — see utils/kioskSession.js. Desktop skips straight to exploring.
  const kiosk = useKioskSession(compact);
  useKioskZoomLock(compact);

  const { nodes, error: loadError } = usePublicNodes();
  const [buildingFilter, setBuildingFilter] = useState("all");

  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef(null);

  // First-run coachmarks (see hooks/useOnboardingHints.js). Different
  // sequence per layout since the controls differ (WASD only applies on
  // desktop; the kiosk has one dock button instead of a separate menu and
  // directions button) — the kiosk shows them one at a time (activeId),
  // the desktop shows every remaining one at once (activeIds); see the
  // render below.
  const menuBtnRef = useRef(null);
  const directionsBtnRef = useRef(null);
  const kioskDockBtnRef = useRef(null);
  const onboarding = useOnboardingHints(compact ? ["move", "dock"] : ["move", "menu", "directions"]);

  // Kiosk End Session button: whether feedback was already sent this
  // session, regardless of how the feedback dialog was reached (the FAB's
  // "Give feedback" item or End Session itself). Resets with the rest of
  // the session's state since MainPageContent remounts fresh on onReset.
  const [feedbackGiven, setFeedbackGiven] = useState(false);
  const handleEndSession = () => {
    if (feedbackGiven) overlay.openEndSessionThanks();
    else overlay.openFromDock("feedback");
  };

  // A dismissed hint fades out rather than vanishing — held mounted (with
  // the CSS transition running) for FADE_MS before the real dismiss()
  // actually drops it from the queue. A hint that stops matching WITHOUT
  // going through here (its target got covered by other UI opening, e.g.
  // the menu) just disappears instantly instead, by no longer being
  // rendered at all — see the render below.
  const FADE_MS = 250; // matches .coachmark-banner/.coachmark-pointer's CSS transition
  const [closingHintIds, setClosingHintIds] = useState([]);
  const fadeOutHint = (id) => {
    setClosingHintIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setTimeout(() => {
      onboarding.dismiss(id);
      setClosingHintIds((prev) => prev.filter((x) => x !== id));
    }, FADE_MS);
  };

  // Desktop only: hints left untouched for a full minute fade away on
  // their own, rather than sitting there forever.
  useEffect(() => {
    if (compact || onboarding.activeIds.length === 0) return;
    const ids = onboarding.activeIds;
    const timer = setTimeout(() => ids.forEach(fadeOutHint), 60000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact, onboarding.activeIds.join(",")]);

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

  // A hint's own control being actually used is as good a "got it" as
  // tapping the tooltip's button — dismiss it the moment that happens,
  // rather than leaving it to reappear (once nothing else is covering the
  // screen again) until it's explicitly dismissed.
  useEffect(() => {
    if (panelMode === "menu") onboarding.dismiss("menu");
    else if (panelMode === "directions") onboarding.dismiss("directions");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelMode, onboarding.dismiss]);
  useEffect(() => {
    if (mobileDockOpen) onboarding.dismiss("dock");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobileDockOpen, onboarding.dismiss]);

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
  const { currentId, history, entryYaw, entryPitch, flyover } = nav;

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

  // The kiosk's after-building floor screen: every floor of whichever
  // building the visitor just picked.
  const kioskFloors = useMemo(() => floorsForBuilding(nodes, kiosk.building), [nodes, kiosk.building]);

  // Whether the picked campus has a building screen at all (more than one
  // member building) — drives both the entrance-shortcuts split below and
  // the floor screen's back target. Data-driven via buildingsForCampus, not
  // hardcoded to "main", so any admin-grouped multi-building campus behaves
  // the same way Main Campus does today.
  const kioskCampusIsMultiBuilding = useMemo(
    () => buildingsForCampus(allBuildings(), kiosk.campus, campusForBuilding).length > 1,
    [kiosk.campus]
  );

  // Same screen's entrance shortcuts — only offered for a solo-building
  // campus (e.g. Digital Campus), which has no earlier building screen to
  // offer its Campus entrance on instead. A multi-building campus offers
  // its shared Campus Entrance as its own entry on the building screen (see
  // kioskCampusEntrance below), so it never needs one here.
  const kioskEntranceShortcuts = useMemo(() => {
    if (kioskCampusIsMultiBuilding) return [];
    return findKioskEntranceShortcuts(nodes, kiosk.building, campusForBuilding);
  }, [nodes, kiosk.building, kioskCampusIsMultiBuilding]);

  // The kiosk building screen's "Campus Entrance" entry: the one node an
  // admin flagged as the shared entrance for whichever campus is currently
  // picked (see NodeForm's "Campus entrance" toggle).
  const kioskCampusEntrance = useMemo(
    () => findCampusEntrance(nodes, kiosk.campus, campusForBuilding),
    [nodes, kiosk.campus]
  );

  // The mobile Building dialog's fixed top shortcut is Main Campus's
  // entrance specifically, regardless of what the (separate) kiosk session
  // state currently has picked.
  const mainCampusEntrance = useMemo(() => findMainCampusEntrance(nodes, campusForBuilding), [nodes]);

  const current = currentId ? byId[currentId] : null;

  // Kiosk-only "Nearby" panel (see NearbyRoomsPanel): the 5 closest rooms
  // to wherever the visitor currently is, capped at 8 hops so a same-floor
  // room clear across campus doesn't still count as "nearby" just because
  // there's no cross-floor jump in the way.
  const nearbyRooms = useMemo(
    () => (current ? findNearbyRooms(nodes, current.id, { maxHops: 8, limit: 5 }) : []),
    [nodes, current]
  );

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
    const { outcome, action } = nav.walk(id, angle);
    if (outcome === "ignored") return;
    if (outcome === "moved") {
      afterMove(action);
      // Walking somewhere is the "move" coachmark's own instruction
      // actually followed — fade it out rather than waiting for "Got it".
      fadeOutHint("move");
    } else overlay.heldForFlyover();
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

  // The kiosk's own campus/building/floor sequence's initial pick: lands on
  // the node directly, no flyover — see nav.land.
  const landAtKioskStart = (id, meta) => {
    const { outcome, action } = nav.land(id, meta);
    if (outcome === "moved") afterMove(action);
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

  // Whether the node PanoramaNav is now actually SHOWING is the current one
  // — distinct from `photoReady` above, which only means its bytes have
  // decoded. There's a further gap after that: PanoramaNav's own texture
  // upload for the new scene. Gating the loading overlays on `photoReady`
  // instead of this let them disappear while the outgoing node's panorama
  // was still on screen, mid-upload — see PanoramaNav's `onLiveChange` doc.
  // Starts true so the very first node isn't treated as "outgoing" before
  // PanoramaNav has ever reported in.
  const [sceneLive, setSceneLive] = useState(true);
  // Which node that `sceneLive` report was for. `sceneLive` alone arrives a
  // render late (PanoramaNav reports from an effect), so right after a move
  // it can still say true about the node being left.
  const [liveSceneId, setLiveSceneId] = useState(null);
  const handleLiveChange = (live) => {
    setSceneLive(live);
    setLiveSceneId(live ? current?.id ?? null : null);
  };

  // Kiosk: whether the panorama has been revealed since the campus/building/
  // floor sequence ended. The sequence runs over the default node (whatever
  // landOnDefault picked), so its pick moves AWAY from a node the visitor
  // never chose — the backdrop stays up until the picked node is actually on
  // screen, instead of fading out over the default one mid-load. Latches, so
  // later ordinary moves never bring the backdrop back; resets whenever the
  // sequence starts over.
  const [kioskRevealed, setKioskRevealed] = useState(false);
  if (kiosk.awaitingStart && kioskRevealed) setKioskRevealed(false);
  if (!kiosk.awaitingStart && !kioskRevealed && (!current || liveSceneId === current.id)) setKioskRevealed(true);

  // Selecting a room from search moves the viewer to its attached node (a
  // jump, so it flies over a campus boundary like any other) and opens its
  // info card once it lands. "Get Directions"/"360° View" on the card itself
  // are the explicit actions that go further.
  const openRoomCard = (room) => jumpToSearchResult(room.node.id, { room });

  // Tapping a result in the Nearby panel: same behavior as picking it from
  // search — opens the room card if it has one, otherwise just jumps there.
  const selectNearbyRoom = (entry) => {
    const match = searchableRooms.find((r) => r.roomName.toLowerCase() === entry.room.toLowerCase());
    if (match) openRoomCard(match);
    else jumpToSearchResult(entry.nodeId);
  };

  // Clicking a "room" type marker in the panorama itself. If no saved room
  // details exist for that label, nothing happens — same "only rooms an admin
  // has actually gone through Room Edit for are actionable" rule search
  // already follows.
  const handleRoomMarkerClick = (marker) => {
    const match = findRoomForMarker(marker, searchableRooms);
    if (match) openRoomCard(match);
  };

  // Riding an elevator is a Walk, not a Jump: history is kept, so Back rides
  // you down again. It lands on that elevator's own landing node on the
  // chosen floor, facing out of the doors. During directions, the route's
  // step onto the new floor is exactly this move, so following the route
  // this way just advances it; picking another floor is an ordinary
  // wander-off that reroutes (still honoring stairs vs. elevator).
  const rideElevatorTo = (dest) => {
    overlay.closeElevatorPicker();
    speak(`Taking the elevator to ${floorLabel(dest.floor)}`);
    goTo(dest.node.id, { yaw: arrivalYawFromLanding(dest.marker) });
  };

  // Tapping an elevator landing marker, like pressing the call button: with
  // only one other floor it rides straight there, otherwise it opens the
  // floor picker. Nothing is skipped during directions: the route's floor
  // is simply listed first and marked, so it stays a single extra tap. The
  // panel's own "Ride to …" button (and auto-walk) skip the picker entirely.
  const handleElevatorMarkerClick = (marker) => {
    if (!current) return;
    const destinations = elevatorDestinationsFrom(nodes, current.id, marker.elevatorId);
    if (destinations.length === 0) return;
    if (destinations.length === 1) {
      rideElevatorTo(destinations[0]);
      return;
    }
    overlay.openElevatorPicker({ markerId: marker.id, label: marker.label, currentFloor: current.floor, destinations });
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

  // Every mobile Building dialog / kiosk campus-building-floor screen pick —
  // see hooks/useKioskPicks.js. Every pick here is a fresh start (jump).
  const {
    handleMobileFloorPick,
    handleMobileEntrancePick,
    handleKioskCampusPick,
    handleKioskBuildingPick,
    handleKioskFloorPick,
    handleKioskEntrancePick,
    handleKioskCampusEntrancePick,
  } = useKioskPicks({
    nodes,
    byId,
    buildings: allBuildings(),
    kiosk,
    setBuildingFilter,
    closeBuildingMenu: overlay.closeBuildingMenu,
    currentId,
    jump: jumpToSearchResult,
    land: landAtKioskStart,
  });

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

  const { arrived, nextStopId, nextStopName, nextElevator, turnInstruction, walkStarted } = progress;
  const autoWalking = directions?.autoWalking ?? false;
  // An elevator step is announced as the ride it is, not "Walk to <landing
  // node's name>" — the landing's node name means little to a visitor.
  const nextStepAction = nextElevator ? `🛗 Ride elevator to ${floorLabel(nextElevator.floor)}` : `Walk to ${nextStopName}`;

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

  // Coachmarks only make sense once the visitor is actually looking at a
  // photo with nothing else already open over it — and, on the kiosk, only
  // once they're past the start/building/floor screens.
  const hintsAllowed = initialLoadDone && !!current && !overlayOpen && !kiosk.awaitingStart;

  // Text and target per hint id, shared by both layouts' render below.
  const hintCoachmarkProps = {
    move: {
      raised: compact,
      text: compact
        ? "Touch and drag to look around. Tap a glowing arrow to walk that way."
        : "Drag to look around. Use WASD or the arrow keys to walk and turn.",
    },
    menu: {
      targetRef: menuBtnRef,
      align: "left",
      text: "Open the menu for buildings, entrances and more.",
    },
    directions: { targetRef: directionsBtnRef, text: "Tap here to get directions to any room." },
    dock: { targetRef: kioskDockBtnRef, text: "Tap here for search, directions and more." },
  };

  // Show the person's actual name, not their email — falls back to email
  // only if they skipped the optional name field at registration.
  const displayName = profile?.name || user?.email || "";
  const initials = displayName
    ? displayName.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  // Mobile/kiosk radial menu items — icon-only, fanned out around the
  // FAB (see .mobile-radial-menu). Each opens its own centered modal,
  // same pattern as FeedbackPanel. Back lives as its own stacked button
  // (kiosk-dock-back-btn, above the dock) rather than a radial item, so it's
  // reachable without opening the menu first. Every handler collapses the
  // radial menu itself first (openFromDock) so only the modal is left
  // showing, not both stacked at once.
  const radialItems = [
    {
      key: "feedback",
      icon: "💬",
      title: "Give feedback",
      onClick: () => overlay.openFromDock("feedback"),
    },
    {
      key: "exit",
      icon: "🧭",
      title: "Directions",
      onClick: flow.open, // also collapses the dock
    },
    {
      key: "search",
      icon: "🔍",
      title: "Search",
      onClick: () => overlay.openFromDock("search"),
    },
    {
      key: "building",
      icon: "🏢",
      title: "Choose a building",
      onClick: () => overlay.openFromDock("building"),
    },
    {
      key: "help",
      icon: "❓",
      title: "How to use this tour",
      onClick: () => overlay.openFromDock("help"),
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

      {directions.pendingModeChoice && (
        <div className="directions-mode-choice">
          <p className="field-hint">This route changes floors — how do you want to get there?</p>
          {/* Stop counts make the trade-off visible up front, so the choice
              is one informed tap rather than a guess. */}
          <button className="primary directions-go-btn" onClick={() => flow.chooseMode("stairs")}>
            🪜 Take the stairs
            <span className="directions-mode-sub">{directions.pendingModeChoice.stairsPath.length} stops</span>
          </button>
          <button className="primary directions-go-btn" onClick={() => flow.chooseMode("elevator")}>
            🛗 Take the elevator
            <span className="directions-mode-sub">{directions.pendingModeChoice.elevatorPath.length} stops · step-free</span>
          </button>
        </div>
      )}

      {!directions.path && !directions.pendingModeChoice && (
        <button className="primary directions-go-btn" onClick={flow.get}>Get directions</button>
      )}

      {directions.path && !arrived && (
        <div className="directions-progress">
          <p className="directions-progress-text">
            Stop {directions.stepIndex + 1} of {directions.path.length}
            {nextElevator ? (
              <>{" — "}<strong>Take the elevator</strong> to {floorLabel(nextElevator.floor)}</>
            ) : nextStopName && (
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
                {nextStepAction} →
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
          <p className="field-hint">
            {nextElevator
              ? "The elevator is glowing in the photo — tap it and pick the highlighted floor, or use the button above."
              : "Follow the green hotspot in the photo — it marks the correct path to your destination."}
          </p>
        </div>
      )}
    </>
  );

  return (
    <div className="main-page-layout">
      {directions?.path && arrived && <ArrivalModal kiosk={compact} onDone={flow.close} />}
      {overlay.elevatorPicker && (
        <div className="modal-overlay elevator-picker-overlay" onClick={overlay.closeElevatorPicker}>
          <div className="modal elevator-picker" role="dialog" aria-label="Choose a floor" onClick={(e) => e.stopPropagation()}>
            <h3>{overlay.elevatorPicker.label}</h3>
            <p className="elevator-picker-here">You're on {floorLabel(overlay.elevatorPicker.currentFloor)}. Ride to:</p>
            <div className="elevator-picker-list">
              {(() => {
                // The route's floor, when this is the elevator the route
                // rides next — listed first and marked, so following
                // directions through the picker is still a single tap.
                const routeFloor =
                  nextElevator && nextElevator.markerId === overlay.elevatorPicker.markerId ? nextElevator.floor : null;
                const ordered = [...overlay.elevatorPicker.destinations].sort(
                  (a, b) => (b.floor === routeFloor) - (a.floor === routeFloor)
                );
                return ordered.map((dest) => (
                  <button
                    key={dest.node.id}
                    className={"elevator-picker-option" + (dest.floor === routeFloor ? " elevator-picker-option-route" : "")}
                    onClick={() => rideElevatorTo(dest)}
                  >
                    {floorLabel(dest.floor)}
                    <span className="elevator-picker-sub">
                      {dest.floor === routeFloor ? "On your route · " : ""}{dest.node.name}
                    </span>
                  </button>
                ));
              })()}
            </div>
            <button className="close-btn elevator-picker-close" onClick={overlay.closeElevatorPicker}>✕</button>
          </div>
        </div>
      )}
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
      {/* A solid backdrop behind the kiosk's whole start/campus/building/floor
          sequence. Each of those screens fades in/out on its own (0.6s), and
          a step change toggles two of them at once — without this, the
          moment where both are still mid-fade (each only partially opaque)
          let the panorama underneath show through. This sits just below all
          of them (fixed at z-index 585) and only fades away once actually
          exploring AND the picked node is on screen (see kioskRevealed), so
          that moment reveals solid white instead, and the default node the
          sequence ran over is never glimpsed on the way in. */}
      {compact && <div className={"kiosk-sequence-backdrop" + (kioskRevealed ? " kiosk-sequence-backdrop-hidden" : "")} />}
      {compact && (
        <KioskCampusScreen
          hidden={kiosk.stage !== "campus"}
          buildings={allBuildings()}
          available={new Set(nodes.map((n) => n.building))}
          onPick={handleKioskCampusPick}
        />
      )}
      {compact && (
        <KioskBuildingScreen
          hidden={kiosk.stage !== "building"}
          buildings={allBuildings()}
          available={new Set(nodes.map((n) => n.building))}
          campusId={kiosk.campus}
          campusEntranceNodeId={kioskCampusEntrance ? kioskCampusEntrance.id : null}
          onPick={handleKioskBuildingPick}
          onPickEntrance={handleKioskCampusEntrancePick}
          onBack={kiosk.backToCampus}
        />
      )}
      {compact && (
        <KioskFloorScreen
          hidden={kiosk.stage !== "floor"}
          buildingLabel={kiosk.building ? buildingLabel(kiosk.building) : null}
          floors={kioskFloors}
          entranceShortcuts={kioskEntranceShortcuts}
          onPick={handleKioskFloorPick}
          onPickEntrance={handleKioskEntrancePick}
          onBack={kioskCampusIsMultiBuilding ? kiosk.backToBuilding : kiosk.backToCampus}
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
              {/* Kiosk: a full opaque cover over the panorama band (header and
                  bottom whitespace excluded) until the destination is actually
                  on screen — see sceneLive above for why this isn't photoReady. */}
              {initialLoadDone && !sceneLive && (
                <div className="kiosk-loading-overlay" role="status" aria-label="Loading">
                  <div className="loading-spinner" />
                </div>
              )}
              <PanoramaNav
                sceneKey={current.id}
                url={photoUrl}
                ready={photoReady}
                onLiveChange={handleLiveChange}
                crossFade={kioskRevealed}
                hotspots={hotspots}
                markers={markers}
                onNavigate={goTo}
                onRoomMarkerClick={handleRoomMarkerClick}
                onElevatorMarkerClick={handleElevatorMarkerClick}
                onError={() => {}}
                placing={false}
                onPlaceAngle={() => {}}
                initialYaw={entryYaw}
                initialPitch={entryPitch}
                highlightedId={nextStopId}
                highlightedMarkerId={nextElevator?.markerId ?? null}
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

            {!kioskDialogOpen && !mobileDockOpen && !kiosk.awaitingStart && panelMode !== "room" && (
              <NearbyRoomsPanel
                rooms={nearbyRooms}
                currentFloor={current.floor}
                onSelect={selectNearbyRoom}
                style={{ top: `calc(${KIOSK_TOP_INSET * 100}% + 12px)` }}
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
                centered modal below. Hidden entirely while the room sheet
                already has the visitor's attention. ---------- */}
            {panelMode !== "room" && !kioskDialogOpen && (
              <div
                className={"mobile-side-dock" + (mobileDockOpen ? " mobile-side-dock--open" : " mobile-side-dock--closed")}
                style={{ top: `${KIOSK_PANORAMA_CENTER * 100}%` }}
              >
                <button
                  ref={kioskDockBtnRef}
                  type="button"
                  className={"mobile-side-fab" + (mobileDockOpen ? " mobile-side-fab--open" : " mobile-side-fab--closed")}
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

            {/* ---------- Back: stacked directly above the FAB dock (same
                convention as the desktop rail's stacked buttons — same
                right offset, positioned just above the element below it),
                reachable at arm's length without opening the dock. An
                immediate action, not a modal — same as it was as a radial
                item before moving here. Hidden alongside the dock while
                nobody is exploring yet, and with nothing to go back to. ---------- */}
            {panelMode !== "room" && !kioskDialogOpen && !mobileDockOpen && !kiosk.awaitingStart && history.length > 0 && (
              <button
                type="button"
                className="kiosk-dock-back-btn"
                style={{ top: `calc(${KIOSK_PANORAMA_CENTER * 100}% - 162px)` }}
                onClick={goBack}
                title="Back"
                aria-label="Back"
              >
                ←
              </button>
            )}

            {/* ---------- End Session: stacked directly below the FAB dock
                (mirrors Back's placement above it — same right offset,
                same gap), reachable at arm's length without opening the
                dock. A visitor who hasn't given feedback yet this session
                goes straight to the feedback dialog, same as the dock's own
                "Give feedback" item; one who already has skips straight to
                the thank-you card and system restart. Hidden alongside the
                dock while nobody is exploring yet — "end session" makes no
                sense before the visitor has started. ---------- */}
            {panelMode !== "room" && !kioskDialogOpen && !mobileDockOpen && !kiosk.awaitingStart && (
              <button
                type="button"
                className="kiosk-end-session-btn"
                style={{ top: `calc(${KIOSK_PANORAMA_CENTER * 100}% + 106px)` }}
                onClick={handleEndSession}
                title="End session"
                aria-label="End session"
              >
                ⏻
              </button>
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
                nextStopAction={nextStepAction}
                isElevator={!!nextElevator}
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
                    {mainCampusEntrance && (
                      <div className="mobile-entrance-shortcuts mobile-entrance-shortcuts-top">
                        <button
                          type="button"
                          className="mobile-entrance-btn"
                          onClick={() => handleMobileEntrancePick(mainCampusEntrance.building, mainCampusEntrance.id)}
                        >
                          Main Campus Entrance
                        </button>
                      </div>
                    )}
                    {allBuildings().map((b) => {
                      const floors = [...new Set(nodes.filter((n) => n.building === b.id).map((n) => Number(n.floor)))].sort(
                        (x, y) => x - y
                      );
                      const expanded = floorPickBuilding === b.id;
                      const isHere = b.id === current?.building;
                      // Main Campus's shared entrance already has its own entry above the
                      // building list (mainCampusEntrance) — showing it again per-building
                      // here would repeat the same node three times (GD1/GD2/GD3). A
                      // single-building campus (e.g. Digital Campus) has no such top-level
                      // entry to fall back on, so its own campus entrance stays here.
                      const entranceShortcuts = findKioskEntranceShortcuts(nodes, b.id, campusForBuilding).filter(
                        (s) => !(s.key === "campus" && campusForBuilding(b.id) === "main")
                      );
                      return (
                        <div key={b.id}>
                          <button
                            type="button"
                            className={
                              "mobile-building-option" +
                              (buildingFilter === b.id || expanded ? " mobile-building-option-active" : "") +
                              (isHere ? " mobile-building-option-here" : "")
                            }
                            disabled={floors.length === 0}
                            aria-expanded={expanded}
                            onClick={() => overlay.setFloorPick(expanded ? null : b.id)}
                          >
                            {b.label}
                            {isHere && <span className="mobile-building-here-badge">You are here</span>}
                          </button>
                          {expanded && (
                            <>
                              {entranceShortcuts.length > 0 && (
                                <div className="mobile-entrance-shortcuts">
                                  {entranceShortcuts.map((s) => (
                                    <button
                                      key={s.key}
                                      type="button"
                                      className="mobile-entrance-btn"
                                      onClick={() => handleMobileEntrancePick(b.id, s.nodeId)}
                                    >
                                      {s.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                              <div className="mobile-floor-grid">
                                {floors.map((f) => {
                                  const isCurrentFloor = isHere && f === Number(current?.floor);
                                  return (
                                    <button
                                      key={f}
                                      type="button"
                                      className={"mobile-floor-btn" + (isCurrentFloor ? " mobile-floor-btn-here" : "")}
                                      onClick={() => handleMobileFloorPick(b.id, f)}
                                    >
                                      {floorLabel(f)}
                                    </button>
                                  );
                                })}
                              </div>
                            </>
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
              {initialLoadDone && !sceneLive && <div className="photo-transition-indicator">Loading…</div>}
              <PanoramaNav
                sceneKey={current.id}
                url={photoUrl}
                ready={photoReady}
                onLiveChange={handleLiveChange}
                hotspots={hotspots}
                markers={markers}
                onNavigate={goTo}
                onRoomMarkerClick={handleRoomMarkerClick}
                onElevatorMarkerClick={handleElevatorMarkerClick}
                onError={() => {}}
                placing={false}
                onPlaceAngle={() => {}}
                initialYaw={entryYaw}
                initialPitch={entryPitch}
                highlightedId={nextStopId}
                highlightedMarkerId={nextElevator?.markerId ?? null}
                autoPan={!!nextStopId}
                keyboardNav
                onBack={goBack}
              />

              <div className="floating-title-wrap">
                <div className="floating-title-pill">
                  {history.length > 0 && (
                    <button className="floating-title-back" onClick={goBack} title="Back">←</button>
                  )}
                  <span>{current.name}</span>
                </div>
              </div>

              {/* Floating overlay UI — rail, search bar, and the single
                  floating panel — all positioned over the panorama itself,
                  Maps-style, rather than pushing it aside. */}
              <div className="floating-rail">
                <button ref={menuBtnRef} className="floating-rail-btn" onClick={overlay.toggleMenu} title="Menu">☰</button>
                <div className="floating-rail-spacer" />
              </div>

              {/* Moved out of the rail — fixed position, stacked directly
                  ABOVE where the minimap sits (same left offset, just
                  above its top edge) rather than beside it at the same
                  height. Position stays fixed regardless of whether the
                  minimap is actually showing right now — a safety button
                  shouldn't jump around based on unrelated state. */}
              <button
                ref={directionsBtnRef}
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
                            {allBuildings().map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.label}{b.id === current?.building ? " — you are here" : ""}
                              </option>
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
                                {e.campusEntrance && <span className="entrance-btn-tag">Campus Entrance</span>}
                                {!e.campusEntrance && e.buildingEntrance && (
                                  <span className="entrance-btn-tag">Building Entrance</span>
                                )}
                                <span className="entrance-btn-sub">{buildingLabel(e.building)} · {floorLabel(e.floor)}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <button type="button" className="sidebar-help-btn" onClick={overlay.openHelp}>
                          ❓ How to use this tour
                        </button>
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
        <FlyoverPanel flyover={flyover} kiosk={compact} onComplete={completeFlyover} onCancel={cancelFlyover} />
      )}

      {showFeedback && (
        <FeedbackPanel
          onClose={overlay.closeFeedback}
          onFinished={onReset}
          onSubmitted={() => setFeedbackGiven(true)}
          kiosk={compact}
        />
      )}

      {/* End Session, feedback already given: straight to the same
          thank-you card/countdown/"Keep exploring" cancel FeedbackPanel
          shows after a fresh submission, without re-asking for a rating. */}
      {overlay.endSessionThanks && (
        <KioskThanks onDone={onReset} onResume={overlay.closeEndSessionThanks} />
      )}

      <HelpModal
        open={overlay.help}
        kiosk={compact}
        onClose={overlay.closeHelp}
        onReplay={() => {
          onboarding.replay();
          // Otherwise the coachmarks can't show at all until whatever
          // panel Help itself was opened from (the desktop menu) is
          // closed by hand too.
          overlay.dismiss();
        }}
      />

      {/* First-run coachmarks — see hooks/useOnboardingHints.js. Kiosk shows
          one at a time (activeId); desktop shows every remaining one at
          once (activeIds), since none of them dim the screen or otherwise
          get in each other's way. */}
      {hintsAllowed &&
        (compact ? [onboarding.activeId].filter(Boolean) : onboarding.activeIds).map((id) => (
          <Coachmark
            key={id}
            {...hintCoachmarkProps[id]}
            closing={closingHintIds.includes(id)}
            onDismiss={() => fadeOutHint(id)}
          />
        ))}

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
