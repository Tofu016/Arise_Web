import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import PanoramaNav from "../components/PanoramaNav";
import LoadingScreen from "../components/LoadingScreen";
import RoomCard from "../components/RoomCard";
import FlyoverPanel from "../components/FlyoverPanel";
import CampusMapModal from "../components/CampusMapModal";
import CampusMapPreview from "../components/CampusMapPreview";
import DirectionsMap from "../components/DirectionsMap";
import DirectionsFields from "../components/DirectionsFields";
import DirectionsPeakProbe from "../components/DirectionsPeakProbe";
import KioskRoomCard from "../components/KioskRoomCard";
import KioskStartScreen from "../components/KioskStartScreen";
import KioskCampusScreen from "../components/KioskCampusScreen";
import KioskBuildingScreen from "../components/KioskBuildingScreen";
import KioskFloorScreen from "../components/KioskFloorScreen";
import KioskDialog from "../components/KioskDialog";
import KioskOriginChoice from "../components/KioskOriginChoice";
import KioskModeChoice from "../components/KioskModeChoice";
import KioskPairingScreen from "../components/KioskPairingScreen";
import { useKioskIdentity } from "../hooks/useKioskIdentity";
import { usePairingGesture } from "../hooks/usePairingGesture";
import KioskWalkBar from "../components/KioskWalkBar";
import AutoWalkCountdown from "../components/AutoWalkCountdown";
import ArrivalModal from "../components/ArrivalModal";
import EmergencyNotice, { EmergencyContactsBand } from "../components/EmergencyNotice";
import FeedbackPanel from "../components/FeedbackPanel";
import KioskThanks from "../components/KioskThanks";
import IdlePrompt from "../components/IdlePrompt";
import DesktopIntroOverlay from "../components/DesktopIntroOverlay";
import KioskIntroOverlay from "../components/KioskIntroOverlay";
import SidebarIntroOverlay from "../components/SidebarIntroOverlay";
import NearbyRoomsPanel from "../components/NearbyRoomsPanel";
import DirectoryAccordion from "../components/DirectoryAccordion";
import { useLiveDirectorySettings } from "../hooks/useDirectorySettings";
import menuIconWhite from "../assets/icons/menu-white.svg";
import powerIcon from "../assets/icons/power.svg";
import questionMarkIcon from "../assets/icons/question-mark-CREATIVE-COMMONS-ZERO.svg";
import chevronRightWhite from "../assets/icons/chevron-right-white.svg";
import sdcaLogo from "../assets/images/sdca-logo-full.png";
import sdcaLogoReversedWhite from "../assets/images/sdca-logo-reversed-white.png";
import IconPlaceholder from "../components/IconPlaceholder";
import { useIdleDetector } from "../hooks/useIdleDetector";
import { useAnalytics } from "../hooks/useAnalytics";
import { useOverlay } from "../hooks/useOverlay";
import { useCompactLayout } from "../hooks/useCompactLayout";
import { useKioskSession, useKioskZoomLock, useKioskInspectLock } from "../hooks/useKioskSession";
import { blocksIdle, coverage } from "../utils/overlay";
import { allBuildings, buildingDisplayName, buildingLabel, campusForBuilding, floorLabel } from "../utils/constants";
import { buildHotspots } from "../utils/hotspots";
import { useCustomBuildingsVersion } from "../utils/buildingStore";
import { roomPhotos } from "../utils/roomPhotos";
import { buildSearchableRooms, findMarkerForRoom, findRoomForMarker, pickLocationSuggestions, searchCampus } from "../utils/search";
import { findNearbyRooms } from "../utils/nearbyRooms";
import { elevatorDestinationsFrom, arrivalYawFromLanding } from "../utils/elevators";
import { fireStairsAction } from "../utils/emergencyExits";
import EmergencyStairsBanner from "../components/EmergencyStairsBanner";
import { speak, stopSpeaking } from "../utils/tts";
import { DESKTOP_INTRO_SPEECH, KIOSK_INTRO_SPEECH } from "../utils/introScript";
import {
  floorsForBuilding,
  findKioskEntranceShortcuts,
  findMainCampusEntrance,
  findCampusEntrance,
  buildingsForCampus,
  kioskBuildingHasChoice,
  pickBuildingStart,
  pickFloorStart,
} from "../utils/navigation";
import { prefetchPhoto } from "../utils/photoStore";
import { useNavigation } from "../hooks/useNavigation";
import { useKioskPicks } from "../hooks/useKioskPicks";
import { useDirectionsFlow } from "../hooks/useDirectionsFlow";
import { AUTO_WALK_STEP_SECONDS } from "../hooks/useDirections";
import { usePublicNodes } from "../hooks/usePublicNodes";
import { useNodePhoto } from "../hooks/useNodePhoto";
import { KIOSK_TOP_INSET, KIOSK_BOTTOM_INSET, KIOSK_PANORAMA_FRACTION, KIOSK_CARD_CENTER, KIOSK_PANORAMA_CENTER } from "../utils/kioskLayout";
import { usePlacardDialogs } from "../hooks/usePlacardDialogs";
import { useSavedRooms } from "../hooks/useSavedRooms";
import { resolveSavedRooms } from "../utils/savedRooms";
import { useLiveSignage } from "../hooks/useSignage";
import KioskSignage from "../components/KioskSignage";
import { slidesInCategory } from "../utils/signage";
import Presence from "../components/Presence";
import { useAuth } from "../context/useAuth";

// Compact-layout control dock: how far each radial icon sits from the
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

// Pending real icons — see the icon list handed back to the user.
const PLACEHOLDER = (name) => <IconPlaceholder name={name} className="inline-icon-img" />;
// SVGs loaded via <img> don't inherit CSS currentColor from the host page
// (they render in an isolated document), so a "stroke: currentColor" icon
// can't actually follow the button's color the way the grey/white
// IconPlaceholder assets do with two prebaked colors — same reason this
// needs its own white copy for the accent-filled FAB, not a CSS override.
const MENU_ICON_WHITE = <img src={menuIconWhite} alt="" className="inline-icon-img" />;
const CHEVRON_RIGHT_WHITE = <img src={chevronRightWhite} alt="" className="inline-icon-img" />;
const POWER_ICON = <img src={powerIcon} alt="" className="inline-icon-img" />;

// Kiosk: finishing feedback resets the whole system to the start screen and
// starting node. Remounting the page under a fresh key drops every piece of
// visitor state at once (position, history, panels, route, start screen).
export default function MainPage() {
  const [session, setSession] = useState(0);
  return <MainPageContent key={session} onReset={() => setSession((s) => s + 1)} />;
}

function MainPageContent({ onReset }) {
  useCustomBuildingsVersion(); // pick up admin-created buildings without a reload
  const { user, signOut } = useAuth();
  const compact = useCompactLayout();
  // The bottom band's advertisements (signage); only the Compact layout has
  // that band, so desktop never fetches them.
  const signage = useLiveSignage(compact);
  const footerSlides = useMemo(() => slidesInCategory(signage.slides, "footer"), [signage.slides]);
  const startingSlides = useMemo(() => slidesInCategory(signage.slides, "starting"), [signage.slides]);
  // Kiosk session: the attract screen, then the campus screen, then (only
  // for a multi-building campus) the building screen, then the floor
  // screen, then exploring
  // — see utils/kioskSession.js. Desktop skips straight to exploring.
  const kiosk = useKioskSession(compact);
  // Set by an admin through the hidden pairing gesture; without it the
  // origin modal simply has no "Kiosk Location" (see KioskPairingScreen).
  const kioskIdentity = useKioskIdentity(compact);
  useKioskZoomLock(compact);
  useKioskInspectLock(compact);

  // Analytics session: one per Compact-layout mount (a mount IS a session)
  // or one per browser tab on the desktop layout (see useAnalytics.js).
  // Whether it counts as "kiosk" or "web" is the server's call, from the
  // paired kiosk token. stage_reached fires on every kiosk.stage change;
  // desktop never leaves "exploring", so this also covers desktop's
  // synthetic session-start event on mount.
  const analytics = useAnalytics({ compact, paired: !!kioskIdentity.kiosk, ready: kioskIdentity.ready });
  useEffect(() => {
    analytics.stageReached(kiosk.stage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kiosk.stage]);
  useEffect(() => {
    if (kiosk.campus || kiosk.building) analytics.setLocation(kiosk.campus, kiosk.building);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kiosk.campus, kiosk.building]);

  // Every kiosk reset is a session boundary, so the session is closed here
  // with why it ended. The desktop layout closes its own session on feedback (see
  // useAnalytics' feedbackSubmitted), so it must not send a second end
  // against the fresh id it has already rotated to.
  const endSessionAndReset = (reason) => {
    if (compact) analytics.sessionEnd(reason);
    onReset();
  };

  const { nodes, error: loadError } = usePublicNodes();
  const [buildingFilter, setBuildingFilter] = useState("all");
  // Desktop has no kiosk campus/building picks to attribute a session to,
  // but it does have this filter — the closest desktop equivalent.
  useEffect(() => {
    if (!compact && buildingFilter !== "all") analytics.setLocation(null, buildingFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact, buildingFilter]);

  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef(null);

  // Kiosk's own session-start walkthrough (KioskIntroOverlay), the touch
  // counterpart of DesktopIntroOverlay below. Not persisted: MainPageContent
  // remounts on every kiosk reset, so each new visitor sees it.
  const [kioskIntroSeen, setKioskIntroSeen] = useState(false);

  // Desktop's own session-start walkthrough (DesktopIntroOverlay) — a single
  // upfront splash, same shape as the kiosk's above. Deliberately not
  // persisted: every fresh page load is a new visitor's first impression.
  const [desktopIntroSeen, setDesktopIntroSeen] = useState(false);
  // Same idea, for the app sidebar's own walkthrough (SidebarIntroOverlay) —
  // a separate seen flag per overlay (each covers a different region and
  // starts hidden independently), but a single shared dismiss: clicking
  // either one closes both at once instead of leaving the other still up.
  const [sidebarIntroSeen, setSidebarIntroSeen] = useState(false);
  // Set only by the help button replaying the overlays, never by the
  // session-start display: the narration is an opt-in extra, and a visitor
  // shouldn't get speech they didn't ask for.
  const [narrateIntro, setNarrateIntro] = useState(false);
  const dismissIntro = () => {
    setNarrateIntro(false);
    setDesktopIntroSeen(true);
    setSidebarIntroSeen(true);
  };
  // "How to use this tour" (the sidebar's own help button) replays both
  // overlays.
  const replayIntro = () => {
    setNarrateIntro(true);
    setDesktopIntroSeen(false);
    setSidebarIntroSeen(false);
  };

  // Kiosk End Session button: whether feedback was already sent this
  // session, regardless of how the feedback dialog was reached (the FAB's
  // "Give feedback" item or End Session itself). Resets with the rest of
  // the session's state since MainPageContent remounts fresh on onReset.
  const [feedbackGiven, setFeedbackGiven] = useState(false);
  const handleEndSession = () => {
    if (feedbackGiven) overlay.openEndSessionThanks();
    else overlay.openFromDock("feedback");
  };

  // What's on screen over the panorama — the floating panel, the Compact layout
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
    buildingMenu: buildingMenuOpen,
    floorPick: floorPickBuilding,
    roomCard: selectedRoomCard,
  } = overlay;

  const [campusMapOpen, setCampusMapOpen] = useState(false);
  // The tallest the form gets along the current route (see DirectionsPeakProbe),
  // tagged with the path it was measured for so a stale one is never applied.
  const [directionsPeak, setDirectionsPeak] = useState(null);
  const recordPeak = useCallback((path, height) => setDirectionsPeak({ path, height }), []);
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

  const [desktopMenuOpen, setDesktopMenuOpen] = useState(false);
  const [desktopMenuPos, setDesktopMenuPos] = useState(null);
  const desktopFabRef = useRef(null);
  useLayoutEffect(() => {
    if (!desktopMenuOpen) return;
    const place = () => {
      const r = desktopFabRef.current?.getBoundingClientRect();
      // Clear of the sidebar entirely, not just of the FAB, which sits inside its padding.
      const sidebarRight = desktopFabRef.current?.closest(".app-sidebar")?.getBoundingClientRect().right;
      if (r) setDesktopMenuPos({ top: r.top, left: (sidebarRight ?? r.right) + 16 });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [desktopMenuOpen]);
  useEffect(() => {
    if (!desktopMenuOpen) return;
    const onKey = (e) => e.key === "Escape" && setDesktopMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [desktopMenuOpen]);

  const byId = useMemo(() => Object.fromEntries((nodes || []).map((n) => [n.id, n])), [nodes]);

  // Where the visitor is standing, their history, and any cross-campus
  // flyover in progress — see utils/navigation.js.
  const nav = useNavigation(nodes, byId);
  const { currentId, history, entryYaw, entryPitch, arrival, flyover } = nav;

  // Built by matching each node's "Rooms served" entries against
  // placardDialogs. Rooms/facilities with no Room Edit record are listed too,
  // with a null placard (desktop's sidebar has a "No information." state; the
  // kiosk card just omits the photo/description), so anything rendering a room
  // must treat `placard` as optional.
  const { getForRoom } = usePlacardDialogs();
  const searchableRooms = useMemo(
    () => buildSearchableRooms(nodes, getForRoom, { includeWithoutDetails: true }),
    [nodes, getForRoom, compact]
  );

  // Desktop only: the save button is on RoomCard and the "Saved Directories"
  // group in its directory; the kiosk is a shared screen.
  const { savedNames, isSaved, toggleSaved } = useSavedRooms();
  const directorySettings = useLiveDirectorySettings();
  const savedRooms = useMemo(() => resolveSavedRooms(savedNames, searchableRooms), [savedNames, searchableRooms]);

  // Room search always scans the whole campus regardless of the building filter —
  // that filter only picks which entrances are offered to browse from, it
  // shouldn't stop someone from finding "203" just because they'd selected GD2.
  const { roomResults, placeResults } = useMemo(
    () => searchCampus(searchQuery, nodes, searchableRooms),
    [nodes, searchQuery, searchableRooms]
  );

  // Tracked debounced (not on every keystroke) — a pause in typing is a
  // reasonable proxy for "this is the search they meant to run". matched
  // reflects whether it resolved to an actual room, for the "no results"
  // rate; node_id is the top room hit, for "most searched rooms".
  useEffect(() => {
    if (!searchQuery.trim()) return;
    const timer = setTimeout(() => {
      analytics.roomSearched(searchQuery, roomResults[0]?.node?.id, roomResults.length > 0);
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // A quick "don't know what to search for" starting point — a fresh random
  // sample of rooms and places (see pickLocationSuggestions — rooms with
  // detail records first, plain nodes filling the rest, same breadth typing
  // draws from) shown the moment the (empty) search box or destination
  // field is focused, re-shuffled each time either panel opens.
  const { rooms: randomSuggestions, places: randomPlaceSuggestions } = useMemo(() => {
    return pickLocationSuggestions(nodes, searchableRooms);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelMode, searchableRooms, nodes]);

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

  // Kiosk: warm the photo of every node the visitor could land on with
  // their very next tap, while they're still reading the screen that offers
  // it — a picker tap is always a jump (see lastMoveType above), so it never
  // gets the walk/back crossfade either way; the least it can do is not also
  // cost a fresh fetch. A solo-building, no-choice campus lands straight
  // from the CAMPUS screen itself (see handleKioskCampusPick), skipping the
  // building/floor screens entirely, so it's warmed here instead of waiting
  // for a screen that will never show.
  useEffect(() => {
    if (!compact || !nodes) return;
    const targets = [];
    if (kiosk.stage === "campus") {
      const campusIds = new Set(allBuildings().map((b) => campusForBuilding(b.id)));
      for (const campusId of campusIds) {
        const members = buildingsForCampus(allBuildings(), campusId, campusForBuilding);
        if (members.length !== 1) continue; // multi-building: warmed once its building screen shows instead
        const soleBuildingId = members[0]?.id ?? campusId;
        if (kioskBuildingHasChoice(nodes, soleBuildingId, campusForBuilding)) continue; // lands via its own floor screen
        targets.push(pickBuildingStart(nodes, soleBuildingId));
      }
    } else if (kiosk.stage === "building") {
      targets.push(kioskCampusEntrance);
    } else if (kiosk.stage === "floor") {
      for (const floor of kioskFloors) targets.push(pickFloorStart(nodes, kiosk.building, floor));
      for (const shortcut of kioskEntranceShortcuts) targets.push(byId[shortcut.nodeId]);
    }
    for (const node of targets) {
      if (node?.photo) prefetchPhoto(node.photo);
    }
  }, [compact, nodes, byId, kiosk.stage, kiosk.campus, kiosk.building, kioskFloors, kioskEntranceShortcuts, kioskCampusEntrance]);

  // The Compact layout's Building dialog's fixed top shortcut is Main Campus's
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

  // Kiosk: which kind of move is loading right now — "walk"/"back" (a step
  // to a node the visitor was already looking at through a hotspot, or
  // straight back the way they came) cross-fades into it like the desktop
  // viewer; "jump" (search, a room card, an elevator, or any kiosk picker
  // tap) can land somewhere with no relation to the current view, so it
  // keeps the opaque loading cover instead — see kiosk-loading-overlay
  // below. `null` before any move (the initial kiosk landing), which the
  // cover's other condition (!kioskRevealed) already covers on its own.
  const [lastMoveType, setLastMoveType] = useState(null);

  // What follows a move that actually happened — everything the navigation
  // module deliberately knows nothing about: the search box (the overlay
  // module handles the panel, dock and room card).
  //
  // prevNodeIdRef feeds the walk/jump analytics event's from_node_id: nav's
  // own currentId is still last render's value inside this closure (the
  // commit that already happened is queued, not applied yet), so the only
  // reliable "where they were" is whatever this ref was left at after the
  // previous move. "back" doesn't update it (nor get tracked as a move at
  // all — it's retracing an already-tracked hop, not new exploration; see
  // the Analytics planning notes' walk/jump ratio scheme).
  const prevNodeIdRef = useRef(currentId);
  const afterMove = (action) => {
    setLastMoveType(action.type);
    overlay.moved({ type: action.type, room: action.meta?.room });
    if (action.type !== "back") setSearchQuery("");
    if (action.type === "walk" || action.type === "jump") {
      analytics.move(action.type, prevNodeIdRef.current, action.id);
      prevNodeIdRef.current = action.id;
    }
  };

  // Hotspot click, "Walk to next stop" in directions, and "Skip hallway"
  // (`via`: the stops it passes over).
  const goTo = (id, angle, via) => {
    const { outcome, action } = nav.walk(id, angle, undefined, via);
    if (outcome === "ignored") return;
    if (outcome === "moved") {
      afterMove(action);
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
  const jumpTo = (id, meta, view) => {
    const { outcome, action } = nav.jump(id, meta, view);
    if (outcome === "ignored") return outcome;
    if (outcome === "moved") afterMove(action);
    else overlay.heldForFlyover({ closePanel: true }); // the hop itself is deferred, the panel is not
    return outcome;
  };

  // The visitor picking a destination themselves (search, room card, Nearby)
  // is what "go_to" analytics counts. Directions' own hop to its start node
  // and the kiosk's entrance picks use plain jumpTo, since neither is a
  // chosen destination.
  const jumpToSearchResult = (id, meta, view) => {
    if (jumpTo(id, meta, view) !== "ignored") analytics.goTo(id);
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
    moves: { jump: jumpTo, walk: goTo },
    overlay,
    clearSearch: () => setSearchQuery(""),
  });
  const { directions, progress, suggestions } = flow;

  const toFieldRef = useRef(null);
  const fromFieldRef = useRef(null);
  // Focus (and select, so any pre-filled text is ready to be typed over) the
  // destination field the moment the panel opens, so the visitor doesn't
  // have to tap it first. When the destination is already filled in and the
  // origin is blank (the kiosk's "Custom Location"), the origin gets the
  // focus instead. Keyed off the open/closed transition, not
  // `directions` itself, since that also changes on every keystroke as the
  // visitor types — refocusing/reselecting mid-edit would fight them. Called
  // unconditionally here (before any early returns below) since it's a hook.
  const directionsWasOpenRef = useRef(false);
  useEffect(() => {
    const isOpen = !!directions;
    // Desktop with both ends already chosen (the Directions button on a
    // room): nothing left to search for, so don't focus a field, which would
    // pop the suggestions over a filled-in route. Clicking a field still
    // brings them back via its onFocus.
    const bothPreselected = !compact && !!directions?.toId && !!directions?.fromId;
    if (isOpen && !directionsWasOpenRef.current && !bothPreselected) {
      const originFirst = !!directions.toId && !directions.fromId;
      const target = originFirst ? fromFieldRef : toFieldRef;
      target.current?.focus();
      target.current?.select();
      // The kiosk's own on-screen keyboard (inputMode="none") means the
      // usual OS-keyboard-triggers-focus-styling path doesn't apply here,
      // so the suggestions dropdown is driven straight off `editingField`
      // rather than trusting the native focus event to have landed in
      // time for this same render pass: expand it explicitly so
      // suggestions are already showing the instant the modal opens,
      // not only after the visitor's first tap into the field.
      flow.focusField(originFirst ? "from" : "to");
    }
    directionsWasOpenRef.current = isOpen;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directions]);

  // Tracked the moment a route actually resolves (get(), chooseMode(), or
  // openNearestExit() — see useDirectionsFlow.js), not on every keystroke:
  // directions.path flips from falsy to a real array exactly once per
  // resolved route.
  const directionsPathRef = useRef(null);
  useEffect(() => {
    const path = directions?.path ?? null;
    if (path && path !== directionsPathRef.current) {
      analytics.directionsRequested(directions.fromId, directions.toId);
    }
    directionsPathRef.current = path;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directions?.path]);

  // One hop past the route's next stop, so useNodePhoto can warm a second
  // panorama along the direction the visitor is actually headed instead of
  // stopping at the immediate neighbor — see planSecondHopPrefetch's
  // reasoning for why this stays scoped to the single node on the active
  // route rather than every hotspot's own neighbors.
  const nextStopNode = progress.nextStopId ? byId[progress.nextStopId] : null;
  const nextStopHotspots = useMemo(
    () => (nextStopNode ? buildHotspots(nextStopNode, byId, { withPhoto: true }) : []),
    [nextStopNode, byId]
  );

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
    nextNeighbors: nextStopHotspots,
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
  // are the explicit actions that go further. Lands facing the room's own
  // marker, centered, when its node has one (else the node's starting view);
  // that holds even when the room is in the panorama already on screen.
  const openRoomCard = (room) => {
    const marker = findMarkerForRoom(room.node, room.roomName);
    jumpToSearchResult(room.node.id, { room }, marker && { yaw: marker.yaw, pitch: marker.pitch });
  };
  // Search's "Go To" is a deliberate pick, so the desktop room panel opens
  // fully expanded; picks from the directory (and everywhere else) open as
  // the collapsed peek so the directory stays usable behind it.
  const goToRoom = (room) => openRoomCard({ ...room, openExpanded: true });

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
  // On desktop, a marker whose label isn't in any node's "Rooms served"
  // list still opens the sidebar's "No information." state, anchored to
  // the node the marker was clicked from.
  // Tapping a marker is a deliberate pick like search's "Go To", so the
  // desktop room panel opens fully expanded.
  const handleRoomMarkerClick = (marker) => {
    const match = findRoomForMarker(marker, searchableRooms);
    if (match) goToRoom(match);
    else if (marker.label?.trim()) goToRoom({ roomName: marker.label.trim(), node: current, placard: null });
  };

  // Desktop: the photo a room/facility marker previews on hover, the room's
  // thumbnail (its first photo). None for a marker without saved room details
  // or photos, so it shows no card at all.
  const roomMarkerPhoto = (marker) => roomPhotos(findRoomForMarker(marker, searchableRooms)?.placard)[0] ?? null;

  // Riding an elevator is a Walk, not a Jump: history is kept, so Back rides
  // you down again. It lands on that elevator's own landing node on the
  // chosen floor, facing out of the doors. During directions, the route's
  // step onto the new floor is exactly this move, so following the route
  // this way just advances it; picking another floor is an ordinary
  // wander-off that reroutes (still honoring stairs vs. elevator).
  const rideElevatorTo = (dest) => {
    overlay.closeElevatorPicker();
    speak(`Taking the elevator to ${floorLabel(dest.floor)}`);
    goTo(dest.node.id, { defaultYaw: arrivalYawFromLanding(dest.marker) });
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

  // The room panel's "Go To": jumps to the room's node, facing its marker.
  // Not goToRoom, so the panel keeps the expanded/collapsed state it has.
  const handleRoomGoTo = () => {
    if (selectedRoomCard) openRoomCard(selectedRoomCard);
  };

  // Kiosk: Directions first asks where to start from (see KioskOriginChoice);
  // elsewhere it goes straight to the panel starting at the current node.
  const requestDirectionsTo = (node) => (compact ? overlay.openOriginChoice(node) : flow.openTo(node));

  // Desktop room panel's expanded state. The panel unmounts behind the
  // directions panel, so it's kept here and fed back via openExpanded when
  // closing directions returns to it.
  const roomExpandedRef = useRef(false);
  const trackRoomExpanded = useCallback((expanded) => {
    roomExpandedRef.current = expanded;
  }, []);

  const handleRoomGetDirections = () => {
    if (!selectedRoomCard) return;
    if (!compact) overlay.previewRoom({ ...selectedRoomCard, openExpanded: roomExpandedRef.current });
    requestDirectionsTo(selectedRoomCard.node);
  };

  const kioskNode = kioskIdentity.kiosk?.nodeId ? byId[kioskIdentity.kiosk.nodeId] ?? null : null;

  // Taps on the logo, the node name and the advertisement band feed the
  // hidden pairing gesture; its last step opens the pairing screen.
  const tapForPairing = usePairingGesture(() => overlay.showPanel("pairing"));

  // Every Compact-layout Building dialog / kiosk campus-building-floor screen pick —
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
    jump: jumpTo,
    land: landAtKioskStart,
  });

  const { arrived, nextStopId, nextStopName, nextElevator, nextFireStairs, turnInstruction, walkStarted, skip } = progress;
  const autoWalking = directions?.autoWalking ?? false;
  // An elevator step is announced as the ride it is, not "Walk to <landing
  // node's name>" — the landing's node name means little to a visitor.
  // A step down the hidden fire stairs is named the same way: the door is a
  // marker in the photo, not a stop with a place name.
  const nextStepAction = nextElevator
    ? `Ride elevator to ${floorLabel(nextElevator.floor)}`
    : nextFireStairs
      ? fireStairsAction(nextFireStairs)
      : `Walk to ${nextStopName}`;
  // The marker the route's next step goes through, glowing in the photo: an
  // elevator landing, or the emergency exit marker of the hidden fire stairs.
  const nextStepMarkerId = nextElevator?.markerId ?? nextFireStairs?.markerId ?? null;
  // Tapping the glowing emergency exit marker takes the stairs, the same as
  // the panel's button. Offered only while it is the next step.
  const handleEmergencyExitMarkerClick = nextFireStairs ? () => flow.walkToNext() : undefined;

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

  // The intro overlays only make sense once the visitor is actually looking
  // at a photo with nothing else already open over it — and, on the kiosk,
  // only once they're past the start/building/floor screens.
  const hintsAllowed = initialLoadDone && !!current && !overlayOpen && !kiosk.awaitingStart;

  // Reads the visible intro overlay aloud when it was replayed from the help
  // button; the cleanup stops the speech the moment the overlay closes (or
  // anything else covers it, which unmounts it).
  const introVisible = hintsAllowed && !(compact ? kioskIntroSeen : desktopIntroSeen);
  const narrating = narrateIntro && introVisible;
  useEffect(() => {
    if (!narrating) return;
    speak(compact ? KIOSK_INTRO_SPEECH : DESKTOP_INTRO_SPEECH);
    return stopSpeaking;
  }, [narrating, compact]);

  if (loadError) {
    return (
      <div className="main-page-status">
        <img src="/favicon.svg" alt="" className="main-page-status-logo" draggable="false" />
        <h2>ARISE</h2>
        <p>{loadError}</p>
        <p className="empty-hint">
          If this persists, check that the API (Arise_API) is running and reachable, and that its database has campus data.
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
        {compact && <KioskStartScreen hidden={kiosk.stage !== "start"} onStart={kiosk.start} signageSlides={startingSlides} signageSettings={signage.settings} />}
      </>
    );
  }

  // Only a signed-in admin has an account, so this is the admin's name.
  const displayName = user?.name || user?.email || "";

  // Compact-layout radial menu items — icon-only, fanned out around the
  // FAB (see .mobile-radial-menu). Each opens its own centered modal,
  // same pattern as FeedbackPanel. Back lives as its own stacked button
  // (kiosk-dock-back-btn, above the dock) rather than a radial item, so it's
  // reachable without opening the menu first. Every handler collapses the
  // radial menu itself first (openFromDock) so only the modal is left
  // showing, not both stacked at once.
  // index 0 renders bottom-most on the arc (see radialButtonTransform:
  // index 0 gets the most negative angle, which sweeps downward toward 7
  // o'clock) — Nearest Exit goes first in this array so it lands in that
  // bottom-most slot, the 6th/last position counting top-to-bottom.
  const radialItems = [
    {
      key: "nearest-exit",
      icon: <IconPlaceholder name="emergency-exit" variant="white" className="inline-icon-img" />,
      title: "Nearest Exit",
      onClick: flow.openNearestExit, // also collapses the dock
      className: "mobile-nearest-exit-btn",
    },
    {
      key: "feedback",
      icon: PLACEHOLDER("chat-bubble"),
      title: "Give feedback",
      onClick: () => overlay.openFromDock("feedback"),
    },
    {
      key: "search",
      icon: PLACEHOLDER("search-magnifier"),
      title: "Search",
      onClick: () => overlay.openFromDock("search"),
    },
    {
      key: "building",
      icon: PLACEHOLDER("building"),
      title: "Choose a building",
      onClick: () => overlay.openFromDock("building"),
    },
    {
      key: "help",
      icon: PLACEHOLDER("question-help"),
      title: "How to use this tour",
      // Replays the intro overlay; collapsing the dock first so the
      // overlay's hintsAllowed condition (nothing else open) is met.
      onClick: () => {
        overlay.dismiss();
        setNarrateIntro(true);
        setKioskIntroSeen(false);
      },
    },
  ].filter(Boolean);

  // Desktop menu FAB (right of the sidebar search bar): same actions as the
  // Compact layout dock minus Search, which the sidebar already shows,
  // minus Directions (an icon inside the search bar) and the help button (top
  // right of the panorama). The buttons
  // stack downward from the FAB's own level, over the panorama.
  // Opening one UI closes the others, so nothing opens hidden behind (or
  // stacked under) what was already up. Modals never outlive a menu action;
  // the sidebar views (directions, room card, building list) replace each
  // other.
  const closeModals = () => {
    overlay.closeFeedback();
    setCampusMapOpen(false);
    setAccountMenuOpen(false);
  };
  const desktopMenuItems = [
    {
      key: "building",
      icon: PLACEHOLDER("building"),
      title: "Choose a building",
      // The sidebar shows one thing at a time: directions and the room card
      // outrank the building selector in the render order, so without closing
      // them first it would open hidden behind them.
      onClick: () => {
        closeModals();
        if (directions) flow.close();
        else if (panelMode === "room") overlay.closeRoomCard();
        overlay.openFromDock("building");
      },
    },
    {
      key: "nearest-exit",
      icon: <IconPlaceholder name="emergency-exit" variant="white" className="inline-icon-img" />,
      title: "Nearest Exit",
      onClick: () => {
        closeModals();
        overlay.closeBuildingMenu();
        flow.openNearestExit();
      },
      className: "desktop-menu-btn--exit",
    },
    {
      key: "feedback",
      icon: PLACEHOLDER("chat-bubble"),
      title: "Give feedback",
      onClick: () => {
        closeModals();
        overlay.openFeedback();
      },
    },
  ];

  // Shared by the Compact layout's Building modal and the desktop sidebar's
  // building selector; only the chrome around the list differs.
  const renderBuildingList = () => (
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
                <div className="mobile-floor-subtitle">Floor</div>
                <div className="mobile-floor-grid">
                  {floors.map((f) => {
                    const isCurrentFloor = isHere && f === Number(current?.floor);
                    return (
                      <button
                        key={f}
                        type="button"
                        className={"mobile-floor-btn" + (isCurrentFloor ? " mobile-floor-btn-here" : "")}
                        onClick={() => handleMobileFloorPick(b.id, f)}
                        aria-label={floorLabel(f)}
                      >
                        {f === -1 ? "UG" : f}
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
  );

  // Clicking a room entry (not its buttons) opens that room's panel without
  // moving there; the panel's own "Go To" does the jump.
  const previewRoomEntry = (e, room) => {
    if (e.target.closest("button")) return;
    overlay.previewRoom(room);
  };

  // The two actions on a search result. "Go To" jumps there, "Directions"
  // routes there. onMouseDown + preventDefault keeps the search input
  // focused (its blur closes the panel).
  const renderResultActions = (onGoTo, directionsNode) => (
    <div className="search-result-actions">
      <button
        type="button"
        className="search-result-btn search-result-goto"
        onMouseDown={(e) => { e.preventDefault(); onGoTo(); }}
        title="Go to this location"
      >
        <IconPlaceholder name="location-pin" variant="white" className="inline-icon-img" /> Go To
      </button>
      <button
        type="button"
        className="search-result-btn search-result-directions"
        onMouseDown={(e) => { e.preventDefault(); requestDirectionsTo(directionsNode); }}
        title="Get directions"
      >
        <IconPlaceholder name="directions" variant="white" className="inline-icon-img" /> Directions
      </button>
    </div>
  );

  const searchResultsContent = (
    <>
      {!searchQuery.trim() && (randomSuggestions.length > 0 || randomPlaceSuggestions.length > 0) && (
        <div className="room-search-results">
          <p className="room-search-suggestions-label">Suggested Locations</p>
          {randomSuggestions.map((r) => (
            <div key={r.roomName} className="room-search-result-actionable room-search-result-clickable" onMouseDown={(e) => e.preventDefault()} onClick={(e) => previewRoomEntry(e, r)}>
              <div className="room-search-result-main">
                <span className="room-search-name">{r.roomName}</span>
                <span className="room-search-sub">
                  {buildingLabel(r.node.building)} · {floorLabel(r.node.floor)}
                </span>
              </div>
              {renderResultActions(() => goToRoom(r), r.node)}
            </div>
          ))}
          {randomPlaceSuggestions.map((n) => (
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
        </div>
      )}
      {(roomResults.length > 0 || placeResults.length > 0) && (
        <div className="room-search-results">
          {roomResults.length > 0 && (
            <>
              <p className="room-search-suggestions-label">Rooms</p>
              {roomResults.map((r) => (
                <div key={r.roomName} className="room-search-result-actionable room-search-result-clickable" onMouseDown={(e) => e.preventDefault()} onClick={(e) => previewRoomEntry(e, r)}>
                  <div className="room-search-result-main">
                    <span className="room-search-name">{r.roomName}</span>
                    <span className="room-search-sub">
                      {buildingLabel(r.node.building)} · {floorLabel(r.node.floor)}
                    </span>
                  </div>
                  {renderResultActions(() => goToRoom(r), r.node)}
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
    // Once the route is being walked the fields are just a read-out of it;
    // typing into one drops the route, so suggestions only get in the way.
    if (directions.path && walkStarted) return null;
    // An empty field shows suggestions immediately on open, same "don't
    // know what to search for" idea as the main search bar's own
    // randomSuggestions, so a visitor isn't stuck typing before seeing
    // anything. "from" is normally pre-filled with where they are, so this
    // only reaches it when it was left blank (the kiosk's Custom Location).
    const fieldQuery = field === "to" ? directions.toQuery : directions.fromQuery;
    if (!fieldQuery.trim()) {
      if (randomSuggestions.length === 0 && randomPlaceSuggestions.length === 0) return null;
      return (
        <div className="room-search-results directions-suggestions">
          <p className="room-search-suggestions-label">Suggested Locations</p>
          {randomSuggestions.map((r) => (
            <div key={r.roomName} className="room-search-result" onClick={() => flow.pickRoom(field, r)}>
              <span className="room-search-name">{r.roomName}</span>
              <span className="room-search-sub">
                {buildingLabel(r.node.building)} · {floorLabel(r.node.floor)}
              </span>
            </div>
          ))}
          {randomPlaceSuggestions.map((n) => (
            <div key={n.id} className="room-search-result" onClick={() => flow.pickNode(field, n)}>
              <span className="room-search-name">{n.name}</span>
              <span className="room-search-sub">
                {n.rooms?.length ? `Rooms: ${n.rooms.join(", ")} · ` : ""}
                {buildingLabel(n.building)} · {floorLabel(n.floor)}
              </span>
            </div>
          ))}
        </div>
      );
    }
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

  // These two fields are textareas only so a long place name can wrap onto a
  // second line; the query itself is still a single line, so Enter is ignored.
  const blockEnter = (e) => {
    if (e.key === "Enter") e.preventDefault();
  };

  // Desktop Nearest Exit: the sidebar itself turns into the emergency view
  // (title, the two fields, buttons, red contacts band) instead of the
  // ordinary Directions card, the same way an open room takes the sidebar.
  const emergencySidebar = !compact && panelMode === "directions" && !!directions?.emergency && !arrived;
  // Desktop ordinary Directions: the sidebar itself becomes the view (title,
  // the two fields, buttons, a square map) rather than a card inside it.
  const directionsSidebar = !compact && panelMode === "directions" && !!directions && !arrived && !emergencySidebar;
  const sidebarTakeover = emergencySidebar || directionsSidebar;
  const reservedFormHeight = directionsPeak && directionsPeak.path === directions?.path ? directionsPeak.height : undefined;
  const campusOfNodeId = (id) => (id && byId[id] ? campusForBuilding(byId[id].building) : null);

  // The walking half of the panel: where the visitor is on the route and the
  // buttons to move along it. Also rendered, inert, by DirectionsPeakProbe to
  // measure the route's tallest stage, hence the stage object `st` and `live`
  // (false there: no start-walking state, no emergency button).
  const renderProgress = (st, live = false) => (
    <div className="directions-progress">
      <p className="directions-progress-text">
        Stop {st.stepIndex + 1} of {st.total}
        {st.nextElevator ? (
          <>{": "}<strong>Take the elevator</strong> to {floorLabel(st.nextElevator.floor)}</>
        ) : st.nextFireStairs ? (
          <>{": "}<strong>Emergency Exit stairs ahead</strong>, {st.nextFireStairs.goesDown ? "down" : "up"} to {floorLabel(st.nextFireStairs.floor)}</>
        ) : st.nextStopName && (
          <>
            {": "}
            {st.turnInstruction ? (
              <><strong>{st.turnInstruction}</strong> {st.nextStopName}</>
            ) : (
              <>next: <strong>{st.nextStopName}</strong></>
            )}
          </>
        )}
      </p>
      {live && st.stepIndex === 0 && currentId !== directions.path[0] ? (
        <button className="primary directions-go-btn" onClick={() => flow.startWalking()}>Start walking</button>
      ) : (
        <>
          <button
            className="primary directions-go-btn"
            onClick={() => { overlay.setWalkDialog(false); flow.walkToNext(); }}
            disabled={autoWalking}
          >
            {st.nextElevator && PLACEHOLDER("elevator")}
            {st.nextFireStairs && <IconPlaceholder name="stairs" variant="white" className="inline-icon-img" />} {st.action} {CHEVRON_RIGHT_WHITE}
          </button>
          {st.skip && (
            <button
              className="directions-go-btn directions-skip-btn"
              onClick={() => { overlay.setWalkDialog(false); flow.skipAhead(); }}
              disabled={autoWalking}
            >
              {PLACEHOLDER("skip-forward")} Skip hallway ({st.skip.count} stops)
            </button>
          )}
          <button
            className="directions-go-btn directions-autowalk-btn"
            onClick={() => { overlay.setWalkDialog(false); flow.toggleAutoWalk(); }}
          >
            {autoWalking
              ? <>{PLACEHOLDER("pause")} Stop auto-walk</>
              : <>{PLACEHOLDER("play")} Auto-walk (every {AUTO_WALK_STEP_SECONDS}s)</>}
            {live && autoWalking && <AutoWalkCountdown key={st.stepIndex} />}
          </button>
          {live && directions.emergency && (
            <button className="directions-go-btn" onClick={flow.reportBlocked}>
              This way is blocked
            </button>
          )}
        </>
      )}
      <p className="field-hint">
        {st.nextElevator
          ? "The elevator is glowing in the photo. Tap it and pick the highlighted floor, or use the button above."
          : st.nextFireStairs
            ? "The Emergency Exit sign is glowing in the photo. Tap it, or use the button above."
            : "Follow the yellow hotspot in the photo: it marks the correct path to your destination."}
      </p>
    </div>
  );

  const directionsContent = directions && (
    <>
      <div className="directions-panel-header">
        <h3>{emergencySidebar ? "Emergency Exit" : "Directions"}</h3>
        {!compact && (
          <button className="close-btn" onClick={flow.close}>
            {PLACEHOLDER("close")}
          </button>
        )}
      </div>

      <DirectionsFields>
        <label className="sidebar-field-label">
          <span className="directions-from-label">
            From
            {!compact && directions.fromId && directions.fromId === currentId && (
              <span className="you-are-here-pill">You are here</span>
            )}
          </span>
          <textarea
            className="directions-field"
            rows={sidebarTakeover ? 1 : 2}
            ref={fromFieldRef}
            value={directions.fromQuery}
            onChange={(e) => flow.editField("from", e.target.value)}
            onFocus={() => flow.focusField("from")}
            onKeyDown={blockEnter}
            inputMode={compact ? "none" : undefined}
            placeholder="Starting point"
          />
        </label>
        {!directionsSidebar && renderDirectionsSuggestions("from")}

        <label className="sidebar-field-label">
          <span className="directions-from-label">To</span>
          <textarea
            className="directions-field"
            rows={sidebarTakeover ? 1 : 2}
            ref={toFieldRef}
            value={directions.toQuery}
            onChange={(e) => flow.editField("to", e.target.value)}
            onFocus={() => flow.focusField("to")}
            onKeyDown={blockEnter}
            inputMode={compact ? "none" : undefined}
            placeholder="Destination"
          />
        </label>
      </DirectionsFields>
      {/* In the sidebar the list floats over the map, so both fields' lists
          open below To; From's would otherwise cover the To field. Only one
          is ever active. The zero-height anchor is what pins the list under
          To: an absolutely positioned child of the panel's flex column would
          sit at the panel's top instead of where it is in the flow. */}
      {directionsSidebar ? (
        <div className="directions-suggestions-anchor">
          {renderDirectionsSuggestions("from")}
          {renderDirectionsSuggestions("to")}
        </div>
      ) : renderDirectionsSuggestions("to")}

      {directions.error && <p className="directions-error">{directions.error}</p>}

      {directions.emergency && (
        <EmergencyNotice emergency={directions.emergency} hasRoute={!!directions.path} showContacts={!emergencySidebar} />
      )}

      {directions.pendingModeChoice && (
        <div className="directions-mode-choice">
          <p className="field-hint">This route changes floors. How do you want to get there?</p>
          {/* Stop counts make the trade-off visible up front, so the choice
              is one informed tap rather than a guess. */}
          <button className="primary directions-go-btn" onClick={() => flow.chooseMode("stairs")}>
            {PLACEHOLDER("stairs")} Take the stairs
            <span className="directions-mode-sub">{directions.pendingModeChoice.stairsPath.length} stops</span>
          </button>
          <button className="primary directions-go-btn" onClick={() => flow.chooseMode("elevator")}>
            {PLACEHOLDER("elevator")} Take the elevator
            <span className="directions-mode-sub">{directions.pendingModeChoice.elevatorPath.length} stops · step-free</span>
          </button>
        </div>
      )}

      {!directions.path && !directions.pendingModeChoice && !directions.emergency && (
        <button className="primary directions-go-btn directions-get-btn" onClick={flow.get}>
          <IconPlaceholder name="directions" variant="white" className="inline-icon-img" /> Get directions
        </button>
      )}

      {directions.path && !arrived && renderProgress({
        stepIndex: directions.stepIndex,
        total: directions.path.length,
        nextElevator,
        nextFireStairs,
        nextStopName,
        turnInstruction,
        skip,
        action: nextStepAction,
      }, true)}
    </>
  );

  return (
    <div className={"main-page-layout" + (compact ? "" : " tour-shell")}>
      <Presence show={!!(directions?.path && arrived)}>
        {directions?.path && arrived && (
          <ArrivalModal kiosk={compact} emergency={!!directions.emergency} onDone={flow.close} />
        )}
      </Presence>
      {compact && overlay.originChoice && (
        <KioskOriginChoice
          destinationName={overlay.originChoice.name}
          kioskAvailable={!!kioskNode}
          onCancel={overlay.closeOriginChoice}
          onCurrent={() => {
            const dest = overlay.originChoice;
            overlay.closeOriginChoice();
            flow.routeFrom(current, dest);
          }}
          onKiosk={() => {
            const dest = overlay.originChoice;
            overlay.closeOriginChoice();
            flow.routeFrom(kioskNode, dest);
          }}
          onCustom={() => {
            const dest = overlay.originChoice;
            overlay.closeOriginChoice();
            flow.openToWithBlankOrigin(dest);
          }}
        />
      )}
      {compact && directions?.pendingModeChoice && (
        <KioskModeChoice
          stairsStops={directions.pendingModeChoice.stairsPath.length}
          elevatorStops={directions.pendingModeChoice.elevatorPath.length}
          onStairs={() => flow.chooseMode("stairs")}
          onElevator={() => flow.chooseMode("elevator")}
          onCancel={flow.close}
        />
      )}
      <Presence show={!!overlay.elevatorPicker}>
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
            <button className="close-btn elevator-picker-close" onClick={overlay.closeElevatorPicker}>
              {PLACEHOLDER("close")}
            </button>
          </div>
        </div>
      )}
      </Presence>
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
      {compact && <KioskStartScreen hidden={kiosk.stage !== "start"} onStart={kiosk.start} signageSlides={startingSlides} signageSettings={signage.settings} />}
      <div className="main-page-viewer">
        {!compact && (
          <header className="tour-shell-header">
            <img src={sdcaLogo} alt="St. Dominic College of Asia" className="tour-shell-logo" />
          </header>
        )}
        {compact && (
          <header
            className="tour-shell-header tour-shell-header--centered kiosk-shell-header"
            style={{ height: `${KIOSK_TOP_INSET * 100}%` }}
          >
            <img
              src={sdcaLogo}
              alt="St. Dominic College of Asia"
              className="tour-shell-logo"
              onClick={() => tapForPairing("logo")}
            />
            {current && !kioskDialogOpen && (
              <div className="mobile-title-pill" onClick={() => tapForPairing("title")}>
                <span>{current.name}</span>
              </div>
            )}
          </header>
        )}
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
                  on screen — see sceneLive above for why this isn't photoReady.
                  Only for the kinds of move that can land somewhere unrelated
                  to what's currently on screen (a jump, or still mid-reveal
                  from the campus/building/floor sequence — see lastMoveType
                  above): a walk or back step crosses fades instead, same as
                  the desktop viewer, since there IS a real spatial relation
                  to show. */}
              {initialLoadDone && !sceneLive && (!kioskRevealed || lastMoveType === "jump") && (
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
                aimKey={arrival}
                highlightedId={nextStopId}
                highlightedMarkerId={nextStepMarkerId}
                onEmergencyExitMarkerClick={handleEmergencyExitMarkerClick}
                autoPan={!!nextStopId}
                heightFraction={KIOSK_PANORAMA_FRACTION}
                alwaysShowPreview
                zoomable
                previewsHidden={overlayOpen}
              />
              {!overlayOpen && <EmergencyStairsBanner step={nextFireStairs} compact />}
            </div>

            {/* ---------- Bottom band: the admin's advertisements (signage),
                filling the whitespace left below the panorama, which stays
                plain white when none is live. Shows no controls; its only
                touch is the last step of the hidden pairing gesture, and
                every dialog and backdrop stacks above it. */}
            <div
              className="kiosk-signage-band"
              style={{ height: `${KIOSK_BOTTOM_INSET * 100}%` }}
              onClick={() => tapForPairing("signage")}
            >
              <KioskSignage slides={footerSlides} settings={signage.settings} />
            </div>

            {/* Session-start walkthrough over the panorama band only, so the
                header and signage stay visible — see KioskIntroOverlay.jsx. */}
            <Presence show={hintsAllowed && compact && !kioskIntroSeen} ms={250}>
              <KioskIntroOverlay
                open={hintsAllowed && compact && !kioskIntroSeen}
                onDismiss={() => {
                  setNarrateIntro(false);
                  setKioskIntroSeen(true);
                }}
                style={{ top: `${KIOSK_TOP_INSET * 100}%`, bottom: `${KIOSK_BOTTOM_INSET * 100}%` }}
              />
            </Presence>
            <Presence show={!kioskDialogOpen && !mobileDockOpen && !kiosk.awaitingStart && panelMode !== "room" && nearbyRooms?.length > 0}>
              {!kioskDialogOpen && !mobileDockOpen && !kiosk.awaitingStart && panelMode !== "room" && (
                <NearbyRoomsPanel
                  rooms={nearbyRooms}
                  currentFloor={current.floor}
                  onSelect={selectNearbyRoom}
                  style={{ top: `calc(${KIOSK_TOP_INSET * 100}% + 12px)` }}
                />
              )}
            </Presence>

            <Presence show={mobileDockOpen}>
              {mobileDockOpen && <div className="mobile-panel-backdrop" onClick={overlay.dismiss} />}
            </Presence>

            {/* ---------- Room card: same footprint as the kiosk dialogs
                (top half of the panorama band), not a bottom sheet — the
                screen's very bottom sits at shin height. ---------- */}
            <Presence show={panelMode === "room" && !!selectedRoomCard}>
              {panelMode === "room" && selectedRoomCard && (
                <KioskRoomCard
                  room={selectedRoomCard}
                  onClose={overlay.closeRoomCard}
                  onGoTo={handleRoomGoTo}
                  onGetDirections={handleRoomGetDirections}
                />
              )}
            </Presence>

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
                  type="button"
                  className={"mobile-side-fab" + (mobileDockOpen ? " mobile-side-fab--open" : " mobile-side-fab--closed")}
                  onClick={() => (mobileDockOpen ? overlay.dismiss() : overlay.openDock())}
                  aria-label={mobileDockOpen ? "Close menu" : "Open menu"}
                  aria-expanded={mobileDockOpen}
                  title={mobileDockOpen ? "Close menu" : "Menu"}
                >
                  {mobileDockOpen
                    ? <IconPlaceholder name="close" variant="white" className="inline-icon-img" />
                    : MENU_ICON_WHITE}
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
                {PLACEHOLDER("back")}
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
                {POWER_ICON}
              </button>
            )}

            {/* ---------- Mobile dialogs. Search and directions/exit (and
                feedback, below) are the keyboard modules: they share the
                KioskDialog grid. Account and the Building picker have no
                text entry and stay small centered .modal-overlay/.modal
                boxes, auto-sized to their own content. ---------- */}
            {panelMode === "pairing" && (
              <KioskPairingScreen
                kiosk={kioskIdentity.kiosk}
                onPair={kioskIdentity.pair}
                onUnpair={kioskIdentity.unpair}
                onClose={overlay.closePanel}
              />
            )}

            <Presence show={panelMode === "search"}>
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
            </Presence>

            <Presence show={!!(panelMode === "directions" && directions && !arrived && !walkBarShown && !directions.pendingModeChoice)}>
              {panelMode === "directions" && directions && !arrived && !walkBarShown && !directions.pendingModeChoice && (
                <KioskDialog onClose={flow.close}>
                  <div className="directions-panel">
                    {directionsContent}
                  </div>
                </KioskDialog>
              )}
            </Presence>

            <Presence show={!!walkBarShown}>
            {walkBarShown && (
              <KioskWalkBar
                progressText={`Stop ${directions.stepIndex + 1} of ${directions.path.length}${
                  turnInstruction ? `: ${turnInstruction}` : ""
                }`}
                nextStopAction={nextStepAction}
                isElevator={!!nextElevator}
                isFireStairs={!!nextFireStairs}
                autoWalking={autoWalking}
                stepIndex={directions.stepIndex}
                onWalk={flow.walkToNext}
                skipCount={skip?.count ?? 0}
                onSkip={flow.skipAhead}
                onToggleAutoWalk={() => flow.toggleAutoWalk()}
                onShowDialog={() => overlay.setWalkDialog(true)}
                emergency={directions.emergency}
                onBlocked={flow.reportBlocked}
                onEnd={flow.close}
              />
            )}
            </Presence>

            {buildingMenuOpen && (
              <div
                className="modal-overlay mobile-building-overlay"
                style={{ paddingTop: `calc(${KIOSK_CARD_CENTER * 100}vh - 170px)` }}
                onClick={overlay.closeBuildingMenu}
              >
                <div className="modal mobile-building-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="preview-header">
                    <h3>Choose a building</h3>
                    <button className="close-btn" onClick={overlay.closeBuildingMenu}>
                      {PLACEHOLDER("close")}
                    </button>
                  </div>
                  {renderBuildingList()}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="tour-shell-body">
            <div className="tour-shell-viewport">
              {/* Static left sidebar — every function module (search,
                  buildings/entrances, room card, directions) now renders
                  here instead of as a floating panel over the panorama. */}
              {/* An open room card is a bottom sheet over the directory (see
                  RoomCard.jsx), not a separate sidebar mode, so the
                  directory stays browsable behind its collapsed peek. */}
              <aside
                onMouseDown={
                  directionsSidebar
                    ? (e) => {
                        // Anything but the fields, the list itself or a button
                        // counts as a blank area and dismisses the suggestions.
                        if (!e.target.closest("textarea, .directions-suggestions, button")) flow.blurField();
                      }
                    : undefined
                }
                // The From/To text is inside a <label>, so a click on it would
                // otherwise refocus the field and bring the suggestions back
                // right after the mousedown above closed them.
                onClick={
                  directionsSidebar
                    ? (e) => {
                        if (e.target.closest("label") && !e.target.closest("textarea")) e.preventDefault();
                      }
                    : undefined
                }
                className={
                  "app-sidebar" +
                  (panelMode === "room" && selectedRoomCard ? " app-sidebar-with-room" : "") +
                  (emergencySidebar ? " app-sidebar-emergency" : "") +
                  (directionsSidebar ? " app-sidebar-directions" : "")
                }
              >
                {/* The sidebar's own session-start walkthrough — see
                    SidebarIntroOverlay.jsx and the sidebarIntroSeen state
                    above. Shares dismissIntro with DesktopIntroOverlay
                    below, so clicking either one closes both. */}
                <Presence show={hintsAllowed && !compact && !sidebarIntroSeen} ms={250}>
                  <SidebarIntroOverlay
                    open={hintsAllowed && !compact && !sidebarIntroSeen}
                    onDismiss={dismissIntro}
                  />
                </Presence>
                <div className="app-sidebar-logo">
                  <img src={sdcaLogoReversedWhite} alt="St. Dominic College of Asia" />
                </div>

                <div className="app-sidebar-search">
                  <div className="floating-search-bar">
                    <input
                      ref={searchInputRef}
                      type="text"
                      inputMode="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onFocus={() => {
                        overlay.closeBuildingMenu();
                        overlay.showPanel("search");
                      }}
                      onBlur={overlay.blurSearch}
                      placeholder="Search St. Dominic:"
                      aria-label="Search"
                    />
                    <button
                      type="button"
                      className="floating-search-icon"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        overlay.closeBuildingMenu();
                        overlay.showPanel("search");
                        searchInputRef.current?.focus();
                      }}
                      title="Search"
                    >
                      {PLACEHOLDER("search-magnifier")}
                    </button>
                    <button
                      type="button"
                      className="floating-search-icon floating-search-directions"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        closeModals();
                        overlay.closeBuildingMenu();
                        flow.open();
                      }}
                      title="Get directions"
                      aria-label="Get directions"
                    >
                      {PLACEHOLDER("directions")}
                    </button>
                  </div>

                  {/* Desktop menu FAB, right of the search bar. Its buttons
                      are position: fixed (see desktopMenuPos) because
                      .app-sidebar clips overflow, and they have to spill
                      out over the panorama. */}
                  <button
                    ref={desktopFabRef}
                    type="button"
                    className="desktop-menu-fab"
                    onClick={() => setDesktopMenuOpen((o) => !o)}
                    aria-label={desktopMenuOpen ? "Close menu" : "Open menu"}
                    aria-expanded={desktopMenuOpen}
                    title={desktopMenuOpen ? "Close menu" : "Menu"}
                  >
                    {desktopMenuOpen
                      ? <IconPlaceholder name="close" variant="white" className="inline-icon-img" />
                      : MENU_ICON_WHITE}
                  </button>
                  {desktopMenuOpen && desktopMenuPos && (
                    <>
                      <div className="desktop-menu-backdrop" onClick={() => setDesktopMenuOpen(false)} />
                      <div className="desktop-menu-stack" style={{ top: desktopMenuPos.top, left: desktopMenuPos.left }}>
                        {desktopMenuItems.map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            className={"desktop-menu-btn" + (item.className ? ` ${item.className}` : "")}
                            onClick={() => {
                              setDesktopMenuOpen(false);
                              item.onClick();
                            }}
                            title={item.title}
                            aria-label={item.title}
                          >
                            {item.icon}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* No dedicated toggle for this anymore (the hamburger's
                    gone) — the directory is the sidebar's resting state,
                    shown whenever nothing else (search results, a room
                    card, directions) is occupying the content area. Lives
                    outside .app-sidebar-content (same tier as the logo/
                    search bar above) so it stays put while the accordion
                    scrolls underneath it, instead of scrolling away with
                    the rest of the directory's rows. */}
                {panelMode !== "search" && panelMode !== "directions" && !buildingMenuOpen && (
                  <h3 className="directory-title">Directory</h3>
                )}

                <div
                  className="app-sidebar-content"
                  style={directionsSidebar && reservedFormHeight ? { minHeight: reservedFormHeight } : undefined}
                >
                  {panelMode === "search" && searchResultsContent}

                  {/* The building selector: the Compact layout's modal, shown
                      here in the sidebar instead. Takes the directory's slot
                      while open; search and directions still win (opening
                      either closes it). */}
                  {buildingMenuOpen && panelMode !== "search" && panelMode !== "directions" && (
                    <div className="sidebar-card sidebar-building-panel">
                      <div className="preview-header">
                        <h3>Choose a building</h3>
                        <button className="close-btn" onClick={overlay.closeBuildingMenu} aria-label="Close">
                          {PLACEHOLDER("close")}
                        </button>
                      </div>
                      {renderBuildingList()}
                    </div>
                  )}

                  {!buildingMenuOpen && panelMode !== "search" && (panelMode !== "directions" || (arrived && !!directions)) && (
                    <div className="sidebar-card sidebar-card-directory">
                      <DirectoryAccordion
                        rooms={searchableRooms}
                        savedRooms={savedRooms}
                        settings={directorySettings}
                        onSelect={openRoomCard}
                        selectedRoomName={panelMode === "room" ? selectedRoomCard?.roomName : null}
                        currentBuildingId={current?.building}
                      />
                    </div>
                  )}

                  {panelMode === "directions" && directions && !arrived && (
                    <div className="directions-panel">
                      {directionsContent}
                    </div>
                  )}
                </div>

                {emergencySidebar && <EmergencyContactsBand />}

                {directionsSidebar && directions.path && (
                  <DirectionsPeakProbe
                    path={directions.path}
                    byId={byId}
                    nodes={nodes}
                    renderProgress={renderProgress}
                    onPeak={recordPeak}
                  />
                )}

                {directionsSidebar && (
                  <DirectionsMap
                    fromCampusId={campusOfNodeId(directions.fromId)}
                    toCampusId={campusOfNodeId(directions.toId)}
                    buildingName={buildingDisplayName(current.building)}
                  />
                )}

                {/* Outside .app-sidebar-content so it anchors to the sidebar
                    itself rather than scrolling with the directory. */}
                {panelMode === "room" && selectedRoomCard && (
                  <RoomCard
                    key={`${selectedRoomCard.roomName}:${!!selectedRoomCard.openExpanded}`}
                    room={selectedRoomCard}
                    saved={isSaved(selectedRoomCard.roomName)}
                    onToggleSave={() => toggleSaved(selectedRoomCard.roomName)}
                    onClose={overlay.closeRoomCard}
                    onGoTo={handleRoomGoTo}
                    onGetDirections={handleRoomGetDirections}
                    onExpandedChange={trackRoomExpanded}
                  />
                )}
              </aside>

              {/* Panorama container — the containing block for every
                  floating auxiliary button below (rail, exit, feedback,
                  account): all absolutely positioned relative to THIS
                  element, not the window, so they stay scoped to the
                  panorama now that it's boxed into its own column. */}
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
                  roomMarkerPhoto={roomMarkerPhoto}
                  onElevatorMarkerClick={handleElevatorMarkerClick}
                  onError={() => {}}
                  placing={false}
                  onPlaceAngle={() => {}}
                  initialYaw={entryYaw}
                  initialPitch={entryPitch}
                  aimKey={arrival}
                  highlightedId={nextStopId}
                  highlightedMarkerId={nextStepMarkerId}
                  onEmergencyExitMarkerClick={handleEmergencyExitMarkerClick}
                  autoPan={!!nextStopId}
                  keyboardNav
                  onBack={goBack}
                  wheelZoomable
                />
                <EmergencyStairsBanner step={nextFireStairs} />

                {/* Desktop's session-start walkthrough, scoped to the
                    panorama itself (not the whole screen) — see
                    DesktopIntroOverlay.jsx and the desktopIntroSeen state
                    above. Shares dismissIntro with SidebarIntroOverlay, so
                    clicking either one closes both. */}
                <Presence show={hintsAllowed && !compact && !desktopIntroSeen} ms={250}>
                  <DesktopIntroOverlay
                    open={hintsAllowed && !compact && !desktopIntroSeen}
                    onDismiss={dismissIntro}
                  />
                </Presence>
                {/* .floating-title-center is the ONLY flex item .floating-title-wrap
                    centers — its own width is just the pill's (the back
                    button is position: absolute inside it, so it adds no
                    width), so the name pill lands dead-center in the
                    panorama regardless of whether the back button is
                    showing. Previously the back button was a sibling flex
                    item next to the pill, so justify-content: center
                    centered the (back + gap + pill) row as a whole,
                    dragging the pill itself off-center by half the back
                    button's own width whenever it was present. */}
                <div className="floating-title-wrap">
                  <div className="floating-title-center">
                    {history.length > 0 && (
                      <button
                        type="button"
                        className="floating-title-back"
                        onClick={goBack}
                        title="Back"
                        aria-label="Back"
                      >
                        {PLACEHOLDER("back")}
                      </button>
                    )}
                    <div className="floating-title-pill">
                      <span>{current.name}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom-left: layer button showing the current building,
                    opening the campus map in the middle of the panorama. */}
                <button
                  type="button"
                  className="campus-map-btn"
                  onClick={() => {
                    closeModals();
                    setCampusMapOpen(true);
                  }}
                  aria-label="Open campus map"
                  title="Campus map"
                >
                  <CampusMapPreview campusId={campusForBuilding(current.building)} />
                  <IconPlaceholder name="map-layers" variant="white" className="campus-map-btn-icon" />
                  <span className="campus-map-btn-label">{buildingDisplayName(current.building)}</span>
                </button>
                <Presence show={campusMapOpen}>
                  {campusMapOpen && (
                    <CampusMapModal
                      currentCampusId={campusForBuilding(current.building)}
                      onClose={() => setCampusMapOpen(false)}
                    />
                  )}
                </Presence>

                {/* Top-right corner: replays the intro walkthrough. */}
                <button
                  type="button"
                  className="floating-rail-btn floating-help-btn"
                  onClick={replayIntro}
                  aria-label="How to use this tour"
                  title="How to use this tour"
                >
                  <img src={questionMarkIcon} alt="" className="inline-icon-img" />
                </button>

                {/* Top-left corner; its popover opens downward. */}
                {/* Hidden entirely for a logged-out visitor — same
                    reasoning as the Compact layout's account button above. */}
                {user && (
                  <div className="floating-account-wrap floating-account-wrap-corner" ref={accountMenuRef}>
                    {accountMenuOpen && (
                      <div className="account-popover">
                        <span className="account-popover-name" title={displayName}>{displayName}</span>
                        <Link to="/admin" className="sidebar-admin-btn">{PLACEHOLDER("tools-wrench")} Admin Panel</Link>
                        <button onClick={signOut} className="subtle account-signout">Sign out</button>
                      </div>
                    )}
                    <button
                      className="floating-rail-btn floating-account-btn"
                      onClick={() => {
                        overlay.closeFeedback();
                        setCampusMapOpen(false);
                        setAccountMenuOpen((o) => !o);
                      }}
                      title={displayName}
                    >
                      Admin
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <Presence show={!!flyover} ms={200}>
        {flyover && (
          <FlyoverPanel flyover={flyover} kiosk={compact} onComplete={completeFlyover} onCancel={cancelFlyover} />
        )}
      </Presence>

      <Presence show={!!showFeedback}>
      {showFeedback && (
        <FeedbackPanel
          onClose={overlay.closeFeedback}
          onFinished={() => endSessionAndReset("feedback")}
          onSubmitted={(feedback) => {
            setFeedbackGiven(true);
            analytics.feedbackSubmitted(feedback?.id, feedback?.rating);
          }}
          kiosk={compact}
        />
      )}
      </Presence>

      {/* End Session, feedback already given: straight to the same
          thank-you card/countdown/"Keep exploring" cancel FeedbackPanel
          shows after a fresh submission, without re-asking for a rating. */}
      <Presence show={!!overlay.endSessionThanks}>
        {overlay.endSessionThanks && (
          <KioskThanks onDone={() => endSessionAndReset("feedback")} onResume={overlay.closeEndSessionThanks} />
        )}
      </Presence>

      <Presence show={!!isIdle}>
      {isIdle && (
        <IdlePrompt
          onContinue={resetIdle}
          onStartOver={compact ? () => endSessionAndReset("idle_timeout") : undefined}
          onGiveFeedback={() => {
            resetIdle();
            overlay.openFeedback();
          }}
        />
      )}
      </Presence>
    </div>
  );
}
