import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import PanoramaNav from "../components/PanoramaNav";
import LoadingScreen from "../components/LoadingScreen";
import RoomCard from "../components/RoomCard";
import Room360Modal from "../components/Room360Modal";
import CrossCampusMinimap from "../components/CrossCampusMinimap";
import FlyoverPanel from "../components/FlyoverPanel";
import MobileRoomSheet from "../components/MobileRoomSheet";
import { allBuildings, buildingLabel, defaultHotspotAngle, floorLabel } from "../utils/constants";
import { useCustomBuildingsVersion } from "../utils/buildingStore";
import { searchNodes, searchRooms } from "../utils/search";
import { findPath, getTurnInstruction } from "../utils/pathfinding";
import { usePublicNodes } from "../hooks/usePublicNodes";
import { useSecurePhotoUrl } from "../hooks/useSecurePhotoUrl";
import { useImagePreloaded } from "../hooks/useImagePreloaded";
import { usePlacardDialogs } from "../hooks/usePlacardDialogs";
import { useAuth } from "../context/useAuth";

// Deterministic "where do we start" pick: prefer an entrance, in building
// order (GD1, GD2, GD3, then any admin-added buildings), lowest floor first.
// Falls back to the first node at all if the data has no entrances tagged.
function pickDefaultNode(nodes) {
  if (!nodes || nodes.length === 0) return null;
  const entrances = nodes.filter((n) => n.type === "entrance");
  if (entrances.length === 0) return nodes[0];
  const order = allBuildings().map((b) => b.id);
  return [...entrances].sort((a, b) => {
    const ai = order.indexOf(a.building);
    const bi = order.indexOf(b.building);
    if (ai !== bi) return ai - bi;
    return (a.floor ?? 0) - (b.floor ?? 0);
  })[0];
}

// Same idea, scoped to one building — used by the mobile bottom Building
// selector, which (unlike desktop's hamburger menu) has no separate
// entrances list to browse, so picking a building jumps straight there.
function pickDefaultEntranceForBuilding(nodes, buildingId) {
  if (!nodes) return null;
  const inBuilding = nodes.filter((n) => n.type === "entrance" && n.building === buildingId);
  if (inBuilding.length === 0) return null;
  return [...inBuilding].sort((a, b) => (a.floor ?? 0) - (b.floor ?? 0))[0];
}

// Simple viewport-width check — re-evaluated on resize. Mobile gets a
// dedicated layout (bottom sheets, top bar) rather than a squeezed-down
// version of the desktop floating UI.
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= breakpoint
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return isMobile;
}

export default function MainPage() {
  useCustomBuildingsVersion(); // pick up admin-created buildings without a reload
  const { user, profile, role, signOut } = useAuth();
  const isMobile = useIsMobile();

  const { nodes, error: loadError } = usePublicNodes();
  const [buildingFilter, setBuildingFilter] = useState("all");
  const [currentId, setCurrentId] = useState(null);
  const [history, setHistory] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [entryYaw, setEntryYaw] = useState(0);
  const searchInputRef = useRef(null);

  // Single source of truth for what the floating panel below the search bar
  // is currently showing — only one thing at a time, Maps-style:
  // null | "menu" (desktop hamburger) | "search" | "room" | "directions" | "account" (mobile only)
  const [panelMode, setPanelMode] = useState(null);
  const closePanel = () => setPanelMode(null);
  const toggleMenu = () => setPanelMode((m) => (m === "menu" ? null : "menu"));

  const [arModalOpen, setArModalOpen] = useState(false);

  // The backdrop behind the panel is purely visual on desktop (see
  // .floating-panel-backdrop's pointer-events: none) — it deliberately does
  // NOT intercept clicks there, so the panorama stays freely draggable
  // underneath. Escape is the keyboard-accessible way to close it instead of
  // a backdrop click.
  useEffect(() => {
    if (!panelMode) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") closePanel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [panelMode]);

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

  // Mobile's bottom Building selector is a custom dropdown, not a native
  // <select> — a native select's dropdown position is decided by the
  // browser, not by our CSS, and since this trigger sits right at the
  // bottom edge of the screen, some browsers don't flip it upward on their
  // own, causing the options list to overflow off-screen. This opens
  // upward unconditionally instead, guaranteed to stay on-screen.
  const [buildingMenuOpen, setBuildingMenuOpen] = useState(false);
  const buildingMenuRef = useRef(null);
  useEffect(() => {
    if (!buildingMenuOpen) return;
    const handleOutsideClick = (e) => {
      if (buildingMenuRef.current && !buildingMenuRef.current.contains(e.target)) setBuildingMenuOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [buildingMenuOpen]);

  // Point-to-point directions ("just like Street View"): opened from a
  // search result, holds the from/to text + resolved node ids, the computed
  // path once requested, and how far along it the visitor currently is.
  const [directions, setDirections] = useState(null);
  // shape: { fromQuery, fromId, toQuery, toId, path, stepIndex, error, editingField, kind }
  // kind: "point" (visitor picked the destination) | "exit" (auto-routed to the nearest assembly point)

  // Land directly in the tour instead of an intermediate menu page.
  useEffect(() => {
    if (nodes && currentId === null) {
      const start = pickDefaultNode(nodes);
      if (start) setCurrentId(start.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  const byId = useMemo(() => Object.fromEntries((nodes || []).map((n) => [n.id, n])), [nodes]);

  // Rooms with actual detail records (photo/description/department/use) —
  // built by matching each node's "Rooms served" entries against
  // placardDialogs. Only rooms an admin has actually gone through Room Edit
  // for show up in search this way; a room existing on a node alone isn't
  // enough, since there'd be nothing to show on the card.
  const { getForRoom } = usePlacardDialogs();
  const searchableRooms = useMemo(() => {
    if (!nodes) return [];
    const out = [];
    const seen = new Set();
    for (const n of nodes) {
      for (const roomName of n.rooms || []) {
        const key = roomName.trim().toUpperCase();
        if (seen.has(key)) continue;
        const placard = getForRoom(roomName);
        if (!placard) continue; // no detail record yet — not searchable here
        seen.add(key);
        out.push({ roomName, node: n, placard });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, getForRoom]);

  // Room search always scans the whole campus regardless of the building filter —
  // that filter only picks which entrances are offered to browse from, it
  // shouldn't stop someone from finding "203" just because they'd selected GD2.
  const roomResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchRooms(searchQuery, searchableRooms);
  }, [searchableRooms, searchQuery]);

  // Plain node-name matches (entrances, hallways, etc.) — kept as a fallback
  // alongside room results so searching "Main Entrance" still works the way
  // it always has, not just room numbers/descriptions. Rooms already
  // surfaced above are excluded here to avoid showing the same location twice.
  const placeResults = useMemo(() => {
    if (!nodes || !searchQuery.trim()) return [];
    const roomNodeIds = new Set(roomResults.map((r) => r.node.id));
    return searchNodes(searchQuery, nodes).filter((n) => !roomNodeIds.has(n.id));
  }, [nodes, searchQuery, roomResults]);

  // A quick "don't know what to search for" starting point — a fresh random
  // sample of rooms (that actually have detail records) shown the moment the
  // (empty) search box is focused, re-shuffled each time it's opened.
  const randomSuggestions = useMemo(() => {
    if (searchableRooms.length === 0) return [];
    return [...searchableRooms].sort(() => Math.random() - 0.5).slice(0, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelMode === "search", searchableRooms]);

  // The currently-open Google-Maps-style room detail card, or null.
  const [selectedRoomCard, setSelectedRoomCard] = useState(null);
  const [room360Open, setRoom360Open] = useState(false);
  // Auto-walk: steps through directions.path automatically, one hop every
  // 5s, simulating walking the route hands-free. Off by default — an
  // explicit opt-in via its own button, never triggered by just having a
  // path computed.
  const [autoWalking, setAutoWalking] = useState(false);

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

  // Active flyover, or null when none is in progress. Set by
  // jumpToSearchResult when it detects a genuine cross-campus jump — see
  // that function for the actual detection logic.
  const [flyover, setFlyover] = useState(null);

  // Called unconditionally here (before any early returns below) since it's
  // a hook — the value is only actually used once we reach the main render.
  const { url: securePhotoUrl } = useSecurePhotoUrl(current?.photo);

  // Same "called before any early return" reasoning as securePhotoUrl
  // above — tracks whether the current photo's actual bytes have been
  // decoded and are paintable, not just that the secure-fetch URL
  // resolved. Used below to decide when the FIRST-LOAD splash screen can
  // dismiss; initialLoadDone latches true the first time this succeeds
  // and never resets, so walking to a different node later (which
  // briefly has its own, much smaller .photo-loading-overlay indicator
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

  const hotspots = useMemo(() => {
    if (!current) return [];
    const neighborIds = current.neighbors || [];
    return neighborIds.map((nid, idx) => {
      const target = byId[nid];
      const angle = current.hotspots?.[nid] || defaultHotspotAngle(idx, neighborIds.length);
      return { id: nid, name: target?.name || nid, photo: target?.photo, ...angle };
    });
  }, [current, byId]);

  const markers = current?.markers || [];

  // Shared by every "move the current node" path — goTo (hotspot clicks,
  // AND "Walk to next stop" in directions, since handleWalkToNextStop
  // itself calls goTo) and jumpToSearchResult (search results, building
  // selector, room cards). Detects a genuine cross-campus move — real,
  // DIFFERENT coordinates on both ends, not just any building change —
  // and defers the caller's own normal-path logic into the flyover
  // sequence instead of performing it immediately. GD1/GD2/GD3 all share
  // identical coordinates (same physical cluster), so switching between
  // them correctly never triggers this, regardless of which path is
  // used. Returns true if a flyover was started (caller should stop, not
  // also perform its own jump); false otherwise (caller should proceed
  // normally, exactly as if this helper didn't exist).
  const tryStartFlyover = (targetId, onProceed) => {
    const targetNode = byId[targetId];
    const targetBuildingMeta = targetNode ? allBuildings().find((b) => b.id === targetNode.building) : null;
    const isCrossCampus =
      current &&
      targetNode &&
      currentBuildingMeta?.lat != null &&
      targetBuildingMeta?.lat != null &&
      (currentBuildingMeta.lat !== targetBuildingMeta.lat || currentBuildingMeta.lng !== targetBuildingMeta.lng);

    if (!isCrossCampus) return false;

    setFlyover({
      fromLat: currentBuildingMeta.lat,
      fromLng: currentBuildingMeta.lng,
      fromLabel: buildingLabel(current.building),
      toLat: targetBuildingMeta.lat,
      toLng: targetBuildingMeta.lng,
      toLabel: buildingLabel(targetNode.building),
      onProceed,
    });
    return true;
  };

  const goTo = (id, angle) => {
    const performWalk = () => {
      setHistory((h) => (currentId ? [...h, currentId] : h));
      setCurrentId(id);
      setSearchQuery("");
      setEntryYaw(angle?.yaw ?? 0);
    };
    if (tryStartFlyover(id, performWalk)) return;
    performWalk();
  };

  const goBack = () => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const next = [...h];
      setCurrentId(next.pop());
      setEntryYaw(0);
      return next;
    });
  };

  // Jumping in from search/an entrance/directions is a fresh start, not a
  // "walk from where I was" — there's no path shown yet, just a direct hop.
  // Also dismisses whatever the floating panel was showing, same as Maps
  // closing search/place-details once you actually navigate somewhere.
  const jumpToSearchResult = (id) => {
    const performJump = () => {
      setHistory([]);
      setCurrentId(id);
      setSearchQuery("");
      setEntryYaw(0);
      closePanel();
    };
    if (tryStartFlyover(id, performJump)) {
      closePanel(); // dismiss whatever panel was open, even though the actual jump itself is deferred
      return;
    }
    performJump();
  };

  // Called once the flyover sequence finishes (auto-proceed or Skip) —
  // runs whichever caller's normal-path logic was deferred (goTo's
  // "walk" behavior, or jumpToSearchResult's "jump" behavior), rather
  // than a single hardcoded implementation that would only be correct
  // for one of the two callers.
  const completeFlyover = () => {
    if (!flyover) return;
    const proceed = flyover.onProceed;
    setFlyover(null);
    proceed();
  };

  // Cancelling just closes the flyover — the visitor stays exactly where
  // they already were, no jump happens at all.
  const cancelFlyover = () => setFlyover(null);

  // Keep an active route in sync with wherever the visitor actually is: if
  // they followed the highlighted hotspot, just advance the step counter; if
  // they wandered off onto a different hotspot, re-route from their new spot
  // instead of leaving a stale/broken path on screen.
  useEffect(() => {
    if (!directions?.path || !currentId) return;
    const idx = directions.path.indexOf(currentId);
    if (idx !== -1) {
      if (idx !== directions.stepIndex) {
        setDirections((d) => (d ? { ...d, stepIndex: idx } : d));
      }
      return;
    }
    const reroute = findPath(nodes, currentId, directions.toId);
    setDirections((d) => {
      if (!d) return d;
      if (!reroute) return { ...d, path: null, stepIndex: 0, error: "Lost the route from here — try Get directions again." };
      return { ...d, path: reroute, stepIndex: 0, error: "" };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]);

  // Opening directions always REPLACES whatever the panel was showing
  // (search results, a room card, the menu) — same as Maps switching from
  // place details straight into directions mode, not stacking both.
  const openDirectionsTo = (node) => {
    setDirections({
      fromQuery: current?.name || "",
      fromId: current?.id || null,
      toQuery: node.name,
      toId: node.id,
      path: null,
      stepIndex: 0,
      error: "",
      editingField: null,
      kind: "point",
    });
    setSearchQuery("");
    setPanelMode("directions");
  };

  // Emergency "nearest exit" shortcut: unlike openDirectionsTo, the
  // destination isn't picked by the visitor — it's whichever node has a
  // marker explicitly labeled "Assembly Point" (case-insensitive/trimmed,
  // since this is free-typed by whoever creates the marker) that comes back
  // shortest from where they currently are, checked across every building
  // via the same neighbor graph normal directions use, so a GD2 visitor can
  // route out through GD3's assembly point if that path is actually
  // shorter. The route is computed immediately instead of waiting for a
  // second "Get directions" click, since every second matters here.
  //
  // Deliberately NOT matching on node type/floor — a node with any other
  // exit-type marker (e.g. "Emergency Fire Stairs") is a real, useful
  // waypoint the path may legitimately pass through, but is intentionally
  // NOT a valid endpoint here. Only a marker specifically labeled "Assembly
  // Point" counts as the genuine, complete safe destination — this is what
  // prevents the router from stopping short at a stairwell door instead of
  // routing all the way to an actual outdoor assembly point, and avoids
  // ambiguity if a building ever has more than one ground-floor open area.
  const openDirectionsToNearestExit = () => {
    if (!current || !nodes) return;
    const assemblyPoints = nodes.filter((n) =>
      (n.markers || []).some(
        (m) => m.type === "exit" && (m.label || "").trim().toLowerCase() === "assembly point"
      )
    );
    if (assemblyPoints.length === 0) {
      setDirections({
        fromQuery: current.name,
        fromId: current.id,
        toQuery: "",
        toId: null,
        path: null,
        stepIndex: 0,
        error: 'No assembly point has been set up yet — ask an admin to add an exit marker labeled "Assembly Point."',
        editingField: null,
        kind: "exit",
      });
      setSearchQuery("");
      setPanelMode("directions");
      return;
    }

    let best = null;
    for (const area of assemblyPoints) {
      const path = findPath(nodes, current.id, area.id);
      if (path && (!best || path.length < best.path.length)) best = { area, path };
    }

    setDirections({
      fromQuery: current.name,
      fromId: current.id,
      toQuery: best?.area.name || "",
      toId: best?.area.id || null,
      path: best?.path || null,
      stepIndex: 0,
      error: best ? "" : "No walkable route to an assembly point was found from here.",
      editingField: null,
      kind: "exit",
    });
    setSearchQuery("");
    setPanelMode("directions");
  };

  const closeDirections = () => {
    setDirections(null);
    closePanel();
  };

  // Selecting a room from search just opens its info card — it doesn't move
  // the panorama on its own. "Get Directions"/"360° View" on the card itself
  // are the explicit actions that actually navigate, reusing the exact same
  // machinery a node search result already uses.
  // Selecting a room now also moves the viewer to its attached node, same
  // "teleport" jumpToSearchResult already does for a plain node result —
  // previously this only opened the info card without actually moving
  // anywhere, which read as broken/inconsistent next to node search
  // results doing both at once.
  const openRoomCard = (room) => {
    setHistory([]);
    setCurrentId(room.node.id);
    setEntryYaw(0);
    setSelectedRoomCard(room);
    setSearchQuery("");
    setPanelMode("room");
  };

  // Clicking a "room" type marker in the panorama itself — matches the
  // marker's own label against searchableRooms by name (case/whitespace-
  // insensitive, same normalization convention used throughout this
  // file), since a marker's label is a separate, independently-typed
  // field from a node's "Rooms served" list, not guaranteed to match
  // character-for-character. If no saved room details exist for that
  // label, nothing happens — same "only rooms an admin has actually gone
  // through Room Edit for are actionable" rule search already follows.
  const handleRoomMarkerClick = (marker) => {
    const key = (marker.label || "").trim().toUpperCase();
    const match = searchableRooms.find((r) => r.roomName.trim().toUpperCase() === key);
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

  // Now opens the room's OWN photo360 (set via the "360° room photo" field
  // in Room Edit) as a standalone viewer — previously this just
  // teleported the main tour to the room's node, which wasn't actually
  // showing the room360 feature at all, and was also largely redundant
  // with what opening the card already does since it moves the viewer
  // there itself now. The button is disabled in RoomCard when no
  // photo360 is set, so this can assume one exists.
  const handleRoomView360 = () => {
    if (!selectedRoomCard?.placard?.photo360) return;
    setRoom360Open(true);
  };

  const updateDirectionsField = (field, value) => {
    setDirections((d) => ({
      ...d,
      [field === "from" ? "fromQuery" : "toQuery"]: value,
      [field === "from" ? "fromId" : "toId"]: null,
      editingField: field,
      path: null,
      error: "",
    }));
  };

  const pickDirectionsField = (field, node) => {
    setDirections((d) => ({
      ...d,
      [field === "from" ? "fromQuery" : "toQuery"]: node.name,
      [field === "from" ? "fromId" : "toId"]: node.id,
      editingField: null,
    }));
  };

  // Same as pickDirectionsField, but for a ROOM result — the actual
  // navigable target is still the room's own node (pathfinding operates
  // over nodes, not rooms), but the field displays the room's name, since
  // that's what was actually searched for and picked.
  const pickDirectionsFieldRoom = (field, room) => {
    setDirections((d) => ({
      ...d,
      [field === "from" ? "fromQuery" : "toQuery"]: room.roomName,
      [field === "from" ? "fromId" : "toId"]: room.node.id,
      editingField: null,
    }));
  };

  const directionsQuery =
    directions?.editingField === "from" ? directions?.fromQuery
      : directions?.editingField === "to" ? directions?.toQuery
        : "";

  // Same "rooms first, places second, no duplicates" structure as the main
  // search bar's roomResults/placeResults — the From/To fields previously
  // only ever searched nodes directly, never rooms, unlike the main
  // search bar right next to them.
  const directionsRoomMatches = useMemo(() => {
    if (!directions?.editingField || !directionsQuery?.trim()) return [];
    return searchRooms(directionsQuery, searchableRooms);
  }, [directions?.editingField, directionsQuery, searchableRooms]);

  const directionsPlaceMatches = useMemo(() => {
    if (!directions?.editingField || !nodes || !directionsQuery?.trim()) return [];
    const roomNodeIds = new Set(directionsRoomMatches.map((r) => r.node.id));
    return searchNodes(directionsQuery, nodes).filter((n) => !roomNodeIds.has(n.id));
  }, [directions?.editingField, nodes, directionsQuery, directionsRoomMatches]);

  // Auto-resolves typed text to a node by EXACT name match (case/whitespace
  // -insensitive) — lets "Get directions"/"Start walking" work even when
  // the user typed a name directly and never clicked the autocomplete
  // suggestion, rather than silently failing with fromId/toId stuck at
  // null. Deliberately requires an exact match, not a partial/fuzzy one —
  // an ambiguous partial match could resolve to the wrong node; genuinely
  // ambiguous text still needs the dropdown to disambiguate.
  // Checks node names first, then room names — a room's own resolvable
  // target is its node, same as picking it from the dropdown would set.
  // Keeps this consistent with the From/To suggestions now including
  // rooms, not just nodes.
  const resolveExactNodeMatch = (query) => {
    const q = (query || "").trim().toLowerCase();
    if (!q || !nodes) return null;
    const nodeMatch = nodes.find((n) => n.name.trim().toLowerCase() === q);
    if (nodeMatch) return nodeMatch;
    const roomMatch = searchableRooms.find((r) => r.roomName.trim().toLowerCase() === q);
    return roomMatch ? roomMatch.node : null;
  };

  const handleGetDirections = () => {
    let fromId = directions?.fromId;
    let toId = directions?.toId;
    if (!fromId && directions?.fromQuery) {
      const match = resolveExactNodeMatch(directions.fromQuery);
      if (match) fromId = match.id;
    }
    if (!toId && directions?.toQuery) {
      const match = resolveExactNodeMatch(directions.toQuery);
      if (match) toId = match.id;
    }

    if (!fromId || !toId) {
      setDirections((d) => ({ ...d, error: "Pick both a starting point and a destination from the suggestions, or type the exact name." }));
      return;
    }
    const path = findPath(nodes, fromId, toId);
    if (!path) {
      setDirections((d) => ({ ...d, path: null, error: "No walkable route found between these two points yet." }));
      return;
    }
    // Persist the resolved ids, not just the path — handleStartWalking
    // reads directions.path[0] (itself just the resolved fromId) to know
    // where to teleport; without this, it would still be working from a
    // stale null fromId in state even though the path itself is correct.
    setDirections((d) => ({ ...d, fromId, toId, path, stepIndex: 0, error: "" }));
  };

  const handleStartWalking = () => {
    if (!directions?.path) return;
    jumpToSearchResult(directions.path[0]);
    setDirections((d) => ({ ...d, stepIndex: 0 }));
    setPanelMode("directions"); // jumpToSearchResult closes the panel — reopen it for the route in progress
  };

  const handleWalkToNextStop = () => {
    if (!directions?.path) return;
    const nextId = directions.path[directions.stepIndex + 1];
    if (!nextId) return;
    const hs = hotspots.find((h) => h.id === nextId);
    goTo(nextId, hs ? { yaw: hs.yaw, pitch: hs.pitch } : undefined);
  };

  // Auto-walk: while active, steps through the path automatically, one hop
  // every 5s. Stops ITSELF (not just pauses) rather than leaving a stale
  // background timer — when the destination is reached, or the directions
  // panel closes/loses its path entirely. directions?.path is deliberately
  // in the dependency list even though only its identity matters here: a
  // freshly-computed route should restart the 5s countdown clean, not
  // inherit whatever was left over from a previous one.
  //
  // handleWalkToNextStop is intentionally NOT in the dependency array —
  // it's redefined every render, and including it would clear/restart the
  // timer on every unrelated re-render, breaking the actual 5s wait. Each
  // step already changes directions.stepIndex, which re-runs this effect
  // with a fresh closure anyway.
  useEffect(() => {
    if (!autoWalking) return;
    if (!directions?.path) {
      setAutoWalking(false);
      return;
    }
    const isArrived = directions.stepIndex === directions.path.length - 1;
    if (isArrived) {
      setAutoWalking(false);
      return;
    }
    const timer = setTimeout(handleWalkToNextStop, 5000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoWalking, directions?.stepIndex, directions?.path]);

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
            : "If this persists, check that Firestore has campus data and your account has access."}
        </p>
      </div>
    );
  }

  if (!nodes) {
    return <LoadingScreen show label="Loading campus…" />;
  }

  const photoUrl = securePhotoUrl || "";
  const arrived = directions?.path && directions.stepIndex === directions.path.length - 1;
  const nextStopId = directions?.path?.[directions.stepIndex + 1] || null;
  const nextStopName = nextStopId ? (byId[nextStopId]?.name || nextStopId) : null;
  // The next step's own hotspot on the CURRENT node — same object
  // handleWalkToNextStop already looks up to know which way to face when
  // walking there.
  const nextStopHotspot = nextStopId ? hotspots.find((h) => h.id === nextStopId) : null;
  // Only meaningful once stepIndex > 0 — entryYaw is the direction you
  // arrived facing, set from the hotspot you actually walked through to
  // get here. At stepIndex 0 you're still at the starting node (or
  // haven't even started walking this specific route yet), so there's no
  // real prior direction to turn relative to.
  const turnInstruction =
    directions?.stepIndex > 0 && nextStopHotspot
      ? getTurnInstruction(entryYaw, nextStopHotspot.yaw)
      : null;

  // Show the person's actual name, not their email — falls back to email
  // only if they skipped the optional name field at registration.
  const displayName = profile?.name || user?.email || "";
  const initials = displayName
    ? displayName.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";

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
        <button className="close-btn" onClick={closeDirections}>✕</button>
      </div>

      <label className="sidebar-field-label">
        From
        <input
          type="text"
          value={directions.fromQuery}
          onChange={(e) => updateDirectionsField("from", e.target.value)}
          onFocus={() => setDirections((d) => ({ ...d, editingField: "from" }))}
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
          onFocus={() => setDirections((d) => ({ ...d, editingField: "to" }))}
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
                onClick={() => setAutoWalking((w) => !w)}
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

  const arModal = arModalOpen && (
    <div className="modal-overlay" onClick={() => setArModalOpen(false)}>
      <div className="modal warning-modal" onClick={(e) => e.stopPropagation()}>
        <h4>🚧 In the works!</h4>
        <p>AR navigation is being built and isn't ready yet — check back soon.</p>
        <button className="primary" onClick={() => setArModalOpen(false)}>OK</button>
      </div>
    </div>
  );

  return (
    <div className="main-page-layout">
      {/* Overlays everything below until the current node's photo has
          actually finished decoding, not just until nodes data has
          loaded — matches how the !nodes early-return above already
          shows the same LoadingScreen for the initial data-fetch phase,
          this is just the continuation of that same splash into the
          photo-decode phase. Latches via initialLoadDone so it never
          reappears once shown, unlike .photo-loading-overlay below
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
            {current.photo && !photoUrl && (
              <div className="photo-loading-overlay">Loading photo…</div>
            )}
            <PanoramaNav
              key={current.id}
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

            {/* ---------- Mobile top bar: AR stub, combined title/search, account ---------- */}
            <div className="mobile-topbar">
              {history.length > 0 && (
                <button className="mobile-back-btn" onClick={goBack} title="Back">←</button>
              )}
              <button className="mobile-ar-btn" onClick={() => setArModalOpen(true)}>AR</button>
              <button
                className="mobile-ar-btn mobile-exit-btn"
                onClick={openDirectionsToNearestExit}
                title="Find the nearest exit"
              >
                🚨
              </button>
              <div className="mobile-search-wrap">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setPanelMode("search")}
                  onBlur={() => setPanelMode((m) => (m === "search" ? null : m))}
                  placeholder={current?.name || "Search a room..."}
                  aria-label="Search"
                />
              </div>
              <button
                className="mobile-account-btn"
                onClick={() => setPanelMode((m) => (m === "account" ? null : "account"))}
                title={displayName}
              >
                {initials}
              </button>
            </div>

            {showMinimap && panelMode !== "search" && panelMode !== "account" && (
              <CrossCampusMinimap
                lat={currentBuildingMeta.lat}
                lng={currentBuildingMeta.lng}
                label={buildingLabel(current.building)}
                className="minimap-widget-mobile"
              />
            )}

            {/* ---------- Top-anchored panels: search results / account ---------- */}
            {(panelMode === "search" || panelMode === "account") && (
              <>
                <div className="mobile-top-panel-backdrop" onClick={closePanel} />
                <div className="mobile-top-panel">
                  {panelMode === "search" && searchResultsContent}
                  {panelMode === "account" && (
                    <div className="mobile-account-panel">
                      <div className="account-avatar">{initials}</div>
                      <span className="account-name" title={displayName}>{displayName}</span>
                      {role === "admin" && (
                        <Link to="/admin" className="sidebar-admin-btn">🛠 Admin Panel</Link>
                      )}
                      <button onClick={signOut} className="subtle account-signout mobile-signout-btn">Sign out</button>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ---------- Bottom sheets: room card (draggable) / directions (fixed) ---------- */}
            {panelMode === "room" && selectedRoomCard && (
              <MobileRoomSheet
                room={selectedRoomCard}
                onClose={closeRoomCard}
                onGetDirections={handleRoomGetDirections}
                onView360={handleRoomView360}
              />
            )}

            {panelMode === "directions" && directions && (
              <div className="mobile-sheet mobile-directions-sheet">
                <div className="mobile-sheet-content">
                  <div className="mobile-sheet-body directions-panel">
                    {directionsContent}
                  </div>
                </div>
              </div>
            )}

            {/* ---------- Persistent bottom Building selector — hidden while a
                bottom sheet (room/directions) is already occupying that space. ---------- */}
            {panelMode !== "room" && panelMode !== "directions" && (
              <div className="mobile-bottom-bar" ref={buildingMenuRef}>
                {buildingMenuOpen && (
                  <div className="mobile-building-menu">
                    <div
                      className={"mobile-building-option" + (buildingFilter === "all" ? " mobile-building-option-active" : "")}
                      onClick={() => handleMobileBuildingPick("all")}
                    >
                      All Buildings
                    </div>
                    {allBuildings().map((b) => (
                      <div
                        key={b.id}
                        className={"mobile-building-option" + (buildingFilter === b.id ? " mobile-building-option-active" : "")}
                        onClick={() => handleMobileBuildingPick(b.id)}
                      >
                        {b.label}
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  className="mobile-building-trigger"
                  onClick={() => setBuildingMenuOpen((o) => !o)}
                >
                  {buildingFilter === "all" ? "All Buildings" : buildingLabel(buildingFilter)}
                  <span className="mobile-building-caret">{buildingMenuOpen ? "▴" : "▾"}</span>
                </button>
              </div>
            )}

            {arModal}
          </div>
        ) : (
          <div className="main-page-screen">
              {current.photo && !photoUrl && (
                <div className="photo-loading-overlay">Loading photo…</div>
              )}
              <PanoramaNav
                key={current.id}
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

              {/* Moved out of the rail and up to the top-right — its own
                  popover now needs to open DOWNWARD instead of upward
                  (see .floating-account-wrap-top override), since it's no
                  longer sitting at the bottom of the screen where opening
                  upward made sense. */}
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

              <div className="floating-search-wrap">
                <div className="floating-search-bar">
                  <input
                    ref={searchInputRef}
                    type="text"
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
                    {panelMode === "search" && searchResultsContent}

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
    </div>
  );
}
