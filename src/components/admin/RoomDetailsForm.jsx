import RoomPhotoGallery from "./RoomPhotoGallery";
import RoomMarkerPlacer from "./RoomMarkerPlacer";
import NodePicker from "./NodePicker";
import IconPlaceholder from "../IconPlaceholder";
import linkIcon from "../../assets/icons/link.svg";
import departmentIcon from "../../assets/icons/department.svg";

// The Room and Facility Editor's form, shared by the page (editing the
// selected room) and the "New Room or Facility" dialog, so both read the
// same. Controlled: `draft` in, `onChange(patch)` out. The draft is
// { title, nodeId, description, department, contactNumber, link, photos,
// markerPlacement }, where markerPlacement is a { yaw, pitch } not yet
// written to the marker, or null. A different node
// drops a pending marker placement, which was made on the old node's photo.
//
// `markerRoomName` is the name the marker is saved under on the draft node
// (the saved name, or null for a room that doesn't exist yet).
export default function RoomDetailsForm({
  draft,
  onChange,
  kind,
  nodes,
  nodeDisabled = false,
  titleHint,
  nodeHint,
  markerRoomName = null,
  markerFocusKey,
  photoUploads,
  onFilesPick,
}) {
  const isFacility = kind === "facility";
  const kindName = isFacility ? "Facility" : "Room";
  const markerNode = nodes.find((n) => n.id === draft.nodeId) || null;
  const set = (field) => (e) => onChange({ [field]: e.target.value });

  return (
    <>
      {/* Top row: title/node (left) and the optional department/contact
          number/link (right) side by side. Below it, the description, the
          marker and the photo gallery span the full width. */}
      <div className="room-editor-top-row">
        <div className="room-editor-top-col">
          <label>
            {kindName} title
            <input type="text" value={draft.title} onChange={set("title")} />
          </label>
          {titleHint && <p className="field-hint">{titleHint}</p>}

          <div className="room-edit-field">
            <span>Node</span>
            <NodePicker
              nodes={nodes}
              value={draft.nodeId}
              disabled={nodeDisabled}
              onChange={(id) => onChange(id === draft.nodeId ? {} : { nodeId: id, markerPlacement: null })}
            />
          </div>
          {nodeHint && <p className="field-hint">{nodeHint}</p>}
        </div>

        <div className="room-editor-top-col">
          <span className="room-editor-optional">Optional</span>
          <label>
            <img src={departmentIcon} alt="" className="icon-placeholder-img" /> Department
            <input type="text" value={draft.department} onChange={set("department")} placeholder="e.g. Registrar's Office" />
          </label>

          <label>
            <IconPlaceholder name="call" /> Contact number
            <input
              type="tel"
              value={draft.contactNumber}
              onChange={set("contactNumber")}
              placeholder="e.g. (02) 8123-4567 loc. 210"
              maxLength={50}
            />
          </label>

          <label>
            <img src={linkIcon} alt="" className="icon-placeholder-img" /> Link
            <input
              type="text"
              value={draft.link}
              onChange={set("link")}
              placeholder="https://…"
              className="room-edit-link-input"
            />
          </label>
        </div>
      </div>

      <label>
        Description
        <textarea value={draft.description} onChange={set("description")} rows={5} />
      </label>

      {markerNode ? (
        <RoomMarkerPlacer
          node={markerNode}
          kind={kind}
          roomName={markerRoomName}
          label={draft.title.trim()}
          placement={draft.markerPlacement}
          onPlace={(angle) => onChange({ markerPlacement: angle })}
          onClear={() => onChange({ markerPlacement: null })}
          focusKey={markerFocusKey}
        />
      ) : (
        <div className="room-marker-placer">
          <span className="room-marker-placer-label">Marker position</span>
          <p className="empty-hint">Pick a node first, then place the marker on its panorama.</p>
        </div>
      )}

      <RoomPhotoGallery
        photos={draft.photos}
        versions={photoUploads.photoVersions}
        roomName={draft.title.trim() || markerRoomName || kindName}
        uploadState={photoUploads.uploadState}
        onChange={(photos) => onChange({ photos })}
        onFilesPick={onFilesPick}
        onReblur={photoUploads.reblur}
      />
    </>
  );
}
