import { useState } from "react";
import RoomDetailsForm from "./RoomDetailsForm";
import IconPlaceholder from "../IconPlaceholder";
import { useRoomPhotoUploads } from "../../hooks/useRoomPhotoUploads";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/useConfirm";
import { isRoomNameTaken } from "../../utils/search";
import { markersAfterSave } from "../../utils/roomMarkers";

const KINDS = [
  { id: "room", label: "Room" },
  { id: "facility", label: "Facility" },
];

// "New Room or Facility": the Room and Facility Editor's own form in a
// dialog, so the admin can see they are making a new one rather than
// editing the selected one. A room joins its node's "Rooms served" (its
// marker is optional); a facility IS a facility marker, so it can't be
// created until that marker is placed. `initialNodeId` prefills the node
// from whatever is selected in the page's list; it stays editable.
export default function CreateRoomDialog({ nodes, initialNodeId, updateNode, setMarkers, saveRoomDialog, onCreated, onClose }) {
  const { alert } = useConfirm();
  const toast = useToast();
  const [kind, setKind] = useState("room");
  const [draft, setDraft] = useState({
    title: "",
    nodeId: nodes.some((n) => n.id === initialNodeId) ? initialNodeId : "",
    description: "",
    department: "",
    contactNumber: "",
    link: "",
    photos: [],
    markerPlacement: null,
  });
  const [saving, setSaving] = useState(false);
  const setPhotos = (update) => setDraft((d) => ({ ...d, photos: typeof update === "function" ? update(d.photos) : update }));
  const photoUploads = useRoomPhotoUploads(setPhotos);

  const node = nodes.find((n) => n.id === draft.nodeId) || null;
  const isFacility = kind === "facility";
  const kindName = isFacility ? "Facility" : "Room";

  const handleFilesPick = (e) => {
    if (!node) {
      e.target.value = "";
      toast.error("Pick a node first: photos are stored with its building.");
      return;
    }
    photoUploads.pickFiles(e, { name: draft.title, building: node.building });
  };

  const handleCreate = async () => {
    if (saving || photoUploads.uploadState === "uploading") return;
    const title = draft.title.trim();
    const problem = !title
      ? `${kindName} title can't be empty.`
      : isRoomNameTaken(title, nodes)
        ? `"${title}" is already used by another room or facility. Names must be unique.`
        : !node
          ? `Pick the node this ${kindName.toLowerCase()} is on.`
          : isFacility && !draft.markerPlacement
            ? "Place the facility's marker on the panorama first: a facility is its marker."
            : null;
    if (problem) {
      alert({ title: `Can't create the ${kindName.toLowerCase()}`, message: problem });
      return;
    }

    setSaving(true);
    try {
      if (!isFacility) await updateNode(node.id, { rooms: [...(node.rooms || []), title] });
      const markers = markersAfterSave(node, { kind, newName: title, placement: draft.markerPlacement });
      if (markers) await setMarkers(node.id, markers);
      await saveRoomDialog(title, {
        roomName: title,
        roomDescription: draft.description.trim(),
        department: draft.department.trim(),
        contactNumber: draft.contactNumber.trim(),
        link: draft.link.trim(),
        photos: draft.photos,
      });
      toast.success(`${kindName} "${title}" created.`);
      onCreated(node.id, title);
    } catch (err) {
      toast.error(err.message || `Couldn't create the ${kindName.toLowerCase()}.`);
      setSaving(false);
    }
  };

  return (
    <>
      <div className="modal-overlay">
        <div className="modal room-edit-modal room-create-modal" role="dialog" aria-modal="true" aria-labelledby="room-create-title">
          <div className="preview-header">
            <h3 id="room-create-title">New Room or Facility</h3>
            <button type="button" className="close-btn" onClick={onClose} aria-label="Close" disabled={saving}>
              <IconPlaceholder name="close" className="create-user-close-icon" />
            </button>
          </div>

          <div className="room-editor-list-mode room-create-kind" role="group" aria-label="Kind">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                className={"room-editor-list-mode-opt" + (kind === k.id ? " room-editor-list-mode-opt-active" : "")}
                aria-pressed={kind === k.id}
                onClick={() => {
                  setKind(k.id);
                  setDraft((d) => ({ ...d, markerPlacement: null }));
                }}
              >
                {k.label}
              </button>
            ))}
          </div>

          <RoomDetailsForm
            draft={draft}
            onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
            kind={kind}
            nodes={nodes}
            titleHint="Names must be unique across every room and facility on campus."
            nodeHint={
              isFacility
                ? "The node whose panorama the facility's marker is placed in."
                : 'Where this room is reached from. It is added to that node\'s "Rooms served".'
            }
            photoUploads={photoUploads}
            onFilesPick={handleFilesPick}
          />

          <div className="form-actions create-user-actions">
            <button type="button" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              type="button"
              className="primary"
              onClick={handleCreate}
              disabled={saving || photoUploads.uploadState === "uploading"}
            >
              {saving ? "Creating…" : `Create ${kindName}`}
            </button>
          </div>
        </div>
      </div>
      {photoUploads.blurDialog}
    </>
  );
}
