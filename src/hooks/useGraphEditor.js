import { useEffect, useMemo, useState } from "react";
import { useSecurePhotoUrl } from "./useSecurePhotoUrl";
import { buildHotspots } from "../utils/hotspots";
import * as placement from "../utils/placement";

// React adapter over utils/placement.js for the navigation editors (indoor
// nodes and tour stops alike): holds the session, the add-link box and the
// photo-missing flag, and turns a placement into the right backend call.
//
// `items` is the list being edited; selection and the three backend
// operations come from whichever hook owns that data (the outlet's
// useNodes, or useTourStops).
export function useGraphEditor({ items, selectedId, setSelectedId, setNeighbors, setHotspot, setMarkers }) {
  const byId = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items]);
  const [session, setSession] = useState(placement.initialSession);
  const [photoMissing, setPhotoMissing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addSearch, setAddSearch] = useState("");

  const current = selectedId ? byId[selectedId] : null;
  const { url: securePhotoUrl } = useSecurePhotoUrl(current?.photo);

  useEffect(() => {
    if (securePhotoUrl) setPhotoMissing(false);
  }, [securePhotoUrl]);

  const hotspots = useMemo(() => (current ? buildHotspots(current, byId) : []), [current, byId]);
  const markers = current?.markers || [];
  const candidates = useMemo(() => placement.candidateLinks(items, current, addSearch), [items, current, addSearch]);

  const select = (id) => {
    setSession(placement.selectFresh());
    setSelectedId(id);
    setPhotoMissing(false);
  };

  const goTo = (id, angle) => {
    setSession(placement.walk(session, selectedId, angle));
    setSelectedId(id);
    setPhotoMissing(false);
  };

  const goBack = () => {
    const previous = placement.back(session);
    if (!previous) return;
    setSession(previous.session);
    setSelectedId(previous.id);
    setPhotoMissing(false);
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

  return {
    current,
    byId,
    hotspots,
    markers,
    history: session.history,
    entryYaw: session.entryYaw,
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
  };
}
