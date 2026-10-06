import { useState } from "react";
import PanoramaNav from "../PanoramaNav";
import { useSecurePhotoUrl } from "../../hooks/useSecurePhotoUrl";
import { markersForRoom } from "../../utils/search";

// A marker shown on the panorama before it exists, while a new room or
// facility (or a room without a marker yet) is still a draft.
const DRAFT_MARKER_ID = "__draft";

// The room's or facility's marker on its node's panorama, placeable right
// in the Room and Facility Editor. Placing only sets `placement` ({ yaw,
// pitch }); the owner writes it with the rest of the form on Save, so
// Cancel undoes it like any other field. Navigation Editor still places
// and repositions every kind of marker.
//
// `roomName` is the name the marker is found under on this node (the saved
// name, not a draft rename); `label` is what a new marker would read.
export default function RoomMarkerPlacer({ node, kind, roomName, label, placement, onPlace, onClear, focusKey = "" }) {
  const [placing, setPlacing] = useState(false);
  const { url } = useSecurePhotoUrl(node.photo);

  const existing = markersForRoom(node, kind, roomName)[0] || null;
  const targetId = existing?.id || DRAFT_MARKER_ID;
  const shown = (node.markers || []).map((m) => (m.id === targetId && placement ? { ...m, ...placement } : m));
  if (!existing && placement) shown.push({ id: DRAFT_MARKER_ID, type: kind, label: label || "New marker", ...placement });

  const aim = placement || existing;
  const kindNoun = kind === "facility" ? "facility" : "room";

  let status;
  if (placement) status = existing ? "Moved. Saved with the form." : "Placed. Saved with the form.";
  else if (existing) status = `Placed (yaw ${Math.round(existing.yaw)}°, pitch ${Math.round(existing.pitch)}°).`;
  else status = kind === "facility" ? "Not placed yet: a facility needs its marker." : "No marker yet: optional for a room.";

  return (
    <div className="room-marker-placer">
      <span className="room-marker-placer-label">Marker position</span>
      {placing && (
        <div className="placing-banner">
          Click on the panorama to place the marker{label ? ` "${label}"` : ""}
          <button type="button" onClick={() => setPlacing(false)}>Cancel</button>
        </div>
      )}
      <div className="preview-screen room-marker-screen">
        <PanoramaNav
          key={`${node.id}:${focusKey}`}
          url={url || ""}
          hotspots={[]}
          markers={shown}
          onNavigate={() => {}}
          placing={placing}
          onPlaceAngle={(angle) => {
            onPlace({ yaw: angle.yaw, pitch: angle.pitch });
            setPlacing(false);
          }}
          initialYaw={aim?.yaw ?? 0}
          initialPitch={aim?.pitch ?? 0}
          selectedMarkerId={existing || placement ? targetId : null}
        />
      </div>
      {!node.photo && <p className="photo-missing-note">This node has no photo yet, but the marker can still be placed.</p>}
      <div className="room-marker-placer-row">
        <span className="field-hint">{status}</span>
        <div className="link-actions">
          <button type="button" onClick={() => setPlacing(true)} disabled={placing}>
            {existing || placement ? "Reposition marker" : "Place marker"}
          </button>
          {placement && (
            <button type="button" onClick={onClear}>
              Undo
            </button>
          )}
        </div>
      </div>
      <p className="field-hint">
        Drag to look around. The highlighted marker is this {kindNoun}'s; the others on {node.name} are shown for
        reference.
      </p>
    </div>
  );
}
