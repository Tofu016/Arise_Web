import { useEffect, useMemo, useState } from "react";
import { useSecurePhotoUrl } from "./useSecurePhotoUrl";
import { buildHotspots } from "../utils/hotspots";
import * as placement from "../utils/placement";

// React adapter over utils/placement.js for the navigation editors (indoor
// nodes and tour stops alike): holds the session, the add-link box and the
// photo-missing flag, and turns a placement into the right backend call.
//
// `items` is the list being edited; selection and the backend operations
// come from whichever hook owns that data (the outlet's useNodes, or
// useTourStops). `onCaptureFallback`, if given, is called with a captured
// angle when a capture happens for a reason this hook doesn't itself own
// (e.g. NavigationEditorPage's starting-view capture) — see requestCapture.
export function useGraphEditor({
  items,
  selectedId,
  setSelectedId,
  setNeighbors,
  setHotspot,
  setMarkers,
  setDefaultView,
  clearDefaultView,
  onCaptureFallback,
}) {
  const byId = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items]);
  const [session, setSession] = useState(placement.initialSession);
  const [photoMissing, setPhotoMissing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  // { fromId, fromName, neighborId } while orbiting the destination to
  // capture its arrival view for this one edge — see startSetDefaultView.
  const [defaultViewTarget, setDefaultViewTarget] = useState(null);
  const [captureRequestId, setCaptureRequestId] = useState(0);

  const current = selectedId ? byId[selectedId] : null;
  const { url: securePhotoUrl } = useSecurePhotoUrl(current?.photo);

  useEffect(() => {
    if (securePhotoUrl) setPhotoMissing(false);
  }, [securePhotoUrl]);

  const hotspots = useMemo(() => (current ? buildHotspots(current, byId) : []), [current, byId]);
  const markers = current?.markers || [];
  const candidates = useMemo(() => placement.candidateLinks(items, current, addSearch), [items, current, addSearch]);

  // Shared by every real navigation (goTo, startSetDefaultView): walks the
  // session and selection. Only the public entry points decide whether
  // that navigation should also drop a pending default-view capture.
  const navigateTo = (id, angle) => {
    setSession(placement.walk(session, selectedId, angle));
    setSelectedId(id);
    setPhotoMissing(false);
  };

  const select = (id) => {
    setSession(placement.selectFresh());
    setSelectedId(id);
    setPhotoMissing(false);
    setDefaultViewTarget(null);
  };

  const goTo = (id, angle) => {
    navigateTo(id, angle);
    setDefaultViewTarget(null);
  };

  const goBack = () => {
    const previous = placement.back(session);
    if (!previous) return;
    setSession(previous.session);
    setSelectedId(previous.id);
    setPhotoMissing(false);
    setDefaultViewTarget(null);
  };

  const placeAngle = (angle) => {
    const result = placement.place(session, current, angle);
    if (!result) return;
    setSession(result.session);
    if (result.action.type === "hotspot") setHotspot(current.id, result.action.neighborId, angle);
    else setMarkers(current.id, result.action.markers);
  };

  const addLink = (targetId) => {
    setNeighbors(current.id, placement.withLink(current, targetId));
    setAddSearch("");
    setAdding(false);
    setSession(placement.startPlacingLink(session, targetId)); // immediately ask where to put its arrow
  };

  // Walks to `neighborId` (as a real visitor arriving via this edge would)
  // and marks the edge (current -> neighborId) as awaiting its captured
  // default view. requestCapture() + orbiting there, then confirming, is
  // what actually saves it — see handleCapturedAngle.
  const startSetDefaultView = (neighborId) => {
    if (!current) return;
    const angle = current.hotspots?.[neighborId];
    setDefaultViewTarget({ fromId: current.id, fromName: current.name, neighborId });
    navigateTo(neighborId, angle);
  };

  const cancelSetDefaultView = () => setDefaultViewTarget(null);

  // Bumps the capture request PanoramaNav's onCaptureAngle listens for.
  const requestCapture = () => setCaptureRequestId((n) => n + 1);

  // Routes a captured angle to whichever capture is actually pending: this
  // hook's own default-view flow, or the caller's own (onCaptureFallback) —
  // at most one is ever active at a time.
  const handleCapturedAngle = (angle) => {
    if (defaultViewTarget) {
      setDefaultView(defaultViewTarget.fromId, defaultViewTarget.neighborId, angle);
      setDefaultViewTarget(null);
      goBack(); // done at the destination — return to where this was set from
      return;
    }
    onCaptureFallback?.(angle);
  };

  return {
    current,
    byId,
    hotspots,
    markers,
    history: session.history,
    entryYaw: session.entryYaw,
    entryPitch: session.entryPitch,
    placingFor: session.placingFor,
    placingMarker: session.placingMarker,
    placing: placement.isPlacing(session),
    photoUrl: current?.photo ? securePhotoUrl : null,
    photoMissing,
    setPhotoMissing,
    adding,
    setAdding,
    addSearch,
    setAddSearch,
    candidates,
    select,
    goTo,
    goBack,
    placeAngle,
    addLink,
    cancelAddingLink: () => {
      setAdding(false);
      setAddSearch("");
    },
    removeLink: (id) => setNeighbors(current.id, placement.withoutLink(current, id)),
    startRepositionLink: (id) => setSession(placement.startPlacingLink(session, id)),
    cancelLinkPlacement: () => setSession(placement.cancelLinkPlacement(session)),
    startPlacingMarker: (marker) => setSession(placement.startPlacingMarker(session, marker)),
    startRepositionMarker: (id) => setSession(placement.startRepositionMarker(session, id)),
    cancelMarkerPlacement: () => setSession(placement.cancelMarkerPlacement(session)),
    removeMarker: (id) => setMarkers(current.id, placement.withoutMarker(current, id)),
    defaultViewTarget,
    startSetDefaultView,
    cancelSetDefaultView,
    clearDefaultView: (neighborId) => clearDefaultView(current.id, neighborId),
    captureRequestId,
    requestCapture,
    handleCapturedAngle,
  };
}
