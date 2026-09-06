import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import NodeList from "../../components/NodeList";
import FilterPanel from "../../components/FilterPanel";
import FilePickerButton from "../../components/FilePickerButton";
import { usePlacardDialogs } from "../../hooks/usePlacardDialogs";
import { useSecurePhotoUrl } from "../../hooks/useSecurePhotoUrl";
import { uploadRoomPhoto, uploadRoom360Photo } from "../../utils/roomPhotoSync";

const defaultFilters = {
  building: "all",
  floor: "all",
  type: "all",
  photoStatus: "all",
  search: "",
};

function slugify(text) {
  return (text || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function normalize(name) {
  return (name || "").trim().toUpperCase();
}

// Checks whether newName is already used by any room on any node — since
// room names are the key that links a node's "Rooms served" entry to its
// placardDialogs record, two rooms silently sharing a name would break
// both search and the mobile app's OCR matching, unable to tell which one
// is the "real" match. currentNodeId/currentRoomName are excluded from the
// check — renaming a room to the name it already has (a no-op) shouldn't
// be flagged as a conflict with itself.
function isRoomNameTaken(newName, nodes, currentNodeId, currentRoomName) {
  const key = normalize(newName);
  for (const n of nodes) {
    for (const r of n.rooms || []) {
      if (n.id === currentNodeId && normalize(r) === normalize(currentRoomName)) continue;
      if (normalize(r) === key) return true;
    }
  }
  return false;
}

// Promoted from the old RoomEditPanel modal to a full page. Which node's
// rooms are being edited is the SAME shared selectedNodeId every other
// section uses — picking a node from this page's own Node List (or from
// Node Editor/Navigation Editor earlier) all point at the same node here.
export default function RoomEditorPage() {
  const { nodes, selectedNodeId, setSelectedNodeId, updateNode } = useOutletContext();
  const { getForRoom, saveRoomDialog } = usePlacardDialogs();

  const node = nodes.find((n) => n.id === selectedNodeId) || null;
  const rooms = node?.rooms || [];

  const [filters, setFilters] = useState(defaultFilters);
  const [selectedRoom, setSelectedRoom] = useState(rooms[0] || null);
  useEffect(() => {
    setSelectedRoom(rooms[0] || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id]);

  const existing = selectedRoom ? getForRoom(selectedRoom) : null;

  const [roomTitle, setRoomTitle] = useState(selectedRoom || "");
  const [description, setDescription] = useState("");
  const [department, setDepartment] = useState("");
  const [use, setUse] = useState("");
  const [link, setLink] = useState("");
  const [photoPath, setPhotoPath] = useState("");
  const [uploadState, setUploadState] = useState("idle"); // idle | uploading | done | error
  // Separate state for the 360° photo — a distinct field/upload from the
  // flat "Room photo" above, used specifically by the mobile AR feature's
  // portal preview, not the normal room reference photo.
  const [photo360Path, setPhoto360Path] = useState("");
  const [upload360State, setUpload360State] = useState("idle"); // idle | uploading | done | error
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // Shared by the initial load AND the "Cancel" button below — Cancel
  // just re-runs this same reset, discarding any unsaved edits back to
  // whatever's actually on record. There's no "close to" destination for
  // a full page the way a modal had, so reverting the form in place is
  // the sensible reading of what Cancel means here.
  const resetFromSaved = () => {
    setRoomTitle(selectedRoom || "");
    setDescription(existing?.roomDescription || "");
    setDepartment(existing?.department || "");
    setUse(existing?.use || "");
    setLink(existing?.link || "");
    setPhotoPath(existing?.photo || "");
    setUploadState("idle");
    setPhoto360Path(existing?.photo360 || "");
    setUpload360State("idle");
    setSavedFlash(false);
  };

  // Load whatever's already on record for the selected room every time the
  // room (or its underlying data) changes.
  useEffect(() => {
    resetFromSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoom, existing?.id]);

  const { url: securePhotoUrl } = useSecurePhotoUrl(photoPath);
  const { url: secure360PhotoUrl } = useSecurePhotoUrl(photo360Path);

  const handleFilePick = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedRoom || !node) return;
    const dot = file.name.lastIndexOf(".");
    const ext = dot !== -1 ? file.name.slice(dot) : "";
    const filename = `${slugify(selectedRoom)}${ext}`;
    setUploadState("uploading");
    try {
      const { path } = await uploadRoomPhoto(file, node.building, filename);
      setPhotoPath(path);
      setUploadState("done");
      setTimeout(() => setUploadState((s) => (s === "done" ? "idle" : s)), 2500);
    } catch {
      setUploadState("error");
    }
  };

  const handle360FilePick = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedRoom || !node) return;
    const dot = file.name.lastIndexOf(".");
    const ext = dot !== -1 ? file.name.slice(dot) : "";
    const filename = `${slugify(selectedRoom)}${ext}`;
    setUpload360State("uploading");
    try {
      const { path } = await uploadRoom360Photo(file, node.building, filename);
      setPhoto360Path(path);
      setUpload360State("done");
      setTimeout(() => setUpload360State((s) => (s === "done" ? "idle" : s)), 2500);
    } catch {
      setUpload360State("error");
    }
  };

  const handleSave = async () => {
    if (!selectedRoom || !node || uploadState === "uploading" || upload360State === "uploading") return;

    const trimmedTitle = roomTitle.trim();
    const isRenaming = trimmedTitle !== selectedRoom;

    if (isRenaming) {
      if (!trimmedTitle) {
        alert("Room title can't be empty.");
        return;
      }
      if (isRoomNameTaken(trimmedTitle, nodes, node.id, selectedRoom)) {
        alert(`"${trimmedTitle}" is already used by another room — room names must be unique.`);
        return;
      }
    }

    setSaving(true);
    try {
      if (isRenaming) {
        // Update "Rooms served" first — replace the old name with the new
        // one at the same position, leaving every other room on this node
        // untouched.
        const updatedRooms = (node.rooms || []).map((r) => (r === selectedRoom ? trimmedTitle : r));
        await updateNode(node.id, { rooms: updatedRooms });
      }

      // ocrSearchTerms only ever gets set from the room name (there's no
      // manual editing UI for it) — regenerating it from the current title
      // on every save, not just when renaming, keeps it from ever drifting
      // stale, same normalization saveRoomDialog itself uses when first
      // creating a record.
      const ocrTerm = trimmedTitle.toLowerCase().replace(/[^a-z0-9]/g, "");

      // saveRoomDialog looks the existing record up by the OLD name
      // (selectedRoom) — passing the new name in the patch renames it in
      // place, same document, not a new one, since the document's own
      // Firestore ID was never tied to the room name to begin with.
      await saveRoomDialog(selectedRoom, {
        roomName: trimmedTitle,
        roomDescription: description.trim(),
        department: department.trim(),
        use: use.trim(),
        link: link.trim(),
        photo: photoPath,
        photo360: photo360Path,
        ocrSearchTerms: ocrTerm ? [ocrTerm] : [],
      });

      if (isRenaming) setSelectedRoom(trimmedTitle);

      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (err) {
      alert(err.message || "Couldn't save room details.");
    } finally {
      setSaving(false);
    }
  };

  const sidebar = (
    <div className="room-editor-sidebar">
      <FilterPanel filters={filters} onChange={setFilters} />
      <NodeList
        nodes={nodes}
        filters={filters}
        selectedNodeId={selectedNodeId}
        onSelect={setSelectedNodeId}
      />
    </div>
  );

  return (
    <div className="room-editor-page">
      <div className="room-editor-main">
        <h2 className="admin-page-heading">Room Editor</h2>

        {!node && (
          <p className="empty-hint">Select a node from the list on the right first.</p>
        )}

        {node && rooms.length === 0 && (
          <p className="empty-hint">
            "{node.name}" has no rooms served yet — add one under "Rooms served" in Node Editor first.
          </p>
        )}

        {node && rooms.length > 0 && (
          <div className="room-editor-form-wrap room-edit-modal">
            {rooms.length > 1 && (
              <div className="room-edit-tabs">
                {rooms.map((r) => (
                  <button
                    key={r}
                    className={"room-edit-tab" + (r === selectedRoom ? " room-edit-tab-active" : "")}
                    onClick={() => setSelectedRoom(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}

            {/* Top row: title/description (left) and department/use/link
                (right) side by side. Bottom row: both photo choosers side
                by side, spanning the full width — a different split from
                the previous "all text left, both photos right" layout. */}
            <div className="room-editor-top-row">
              <div className="room-editor-top-col">
                <label>
                  Room title
                  <input type="text" value={roomTitle} onChange={(e) => setRoomTitle(e.target.value)} />
                </label>
                <p className="field-hint">
                  Renaming here updates both "Rooms served" on this node and this room's saved details together —
                  room names must stay unique across the whole campus.
                </p>

                <label>
                  Description
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} />
                </label>
              </div>

              <div className="room-editor-top-col">
                <label>
                  Department
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Registrar's Office"
                  />
                </label>

                <label>
                  Use
                  <input
                    type="text"
                    value={use}
                    onChange={(e) => setUse(e.target.value)}
                    placeholder="e.g. Classroom, Faculty office, Storage"
                  />
                </label>

                <label>
                  🔗 Link
                  <input
                    type="text"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="https://…"
                    className="room-edit-link-input"
                  />
                </label>
                <p className="field-hint">Optional — shown as a clickable link on the room's public panel.</p>
              </div>
            </div>

            <div className="room-editor-photos-row">
              <div className="room-editor-photo-item">
                <label>
                  Room photo
                  <FilePickerButton accept="image/*" onChange={handleFilePick} disabled={uploadState === "uploading"} />
                  <span className="field-hint">
                    {uploadState === "uploading" && "Uploading…"}
                    {uploadState === "done" && "✓ Uploaded"}
                    {uploadState === "error" && "⚠ Upload failed — check Storage rules/connection."}
                    {uploadState === "idle" && !photoPath && "No photo set yet."}
                  </span>
                </label>
                {/* Always shows a preview-sized box, even with no photo set
                    yet — matching the wireframe, which gives both photo
                    sections consistent visual weight regardless of upload
                    state, rather than leaving empty space when unset. */}
                <div className="room-editor-photo-preview-box">
                  {photoPath ? (
                    securePhotoUrl
                      ? <img src={securePhotoUrl} alt={selectedRoom} className="photo-preview" />
                      : <p className="field-hint">Loading photo…</p>
                  ) : (
                    <p className="field-hint">No photo yet</p>
                  )}
                </div>
              </div>

              <div className="room-editor-photo-item">
                <label>
                  360° room photo
                  <FilePickerButton accept="image/*" onChange={handle360FilePick} disabled={upload360State === "uploading"} />
                  <span className="field-hint">
                    {upload360State === "uploading" && "Uploading…"}
                    {upload360State === "done" && "✓ Uploaded"}
                    {upload360State === "error" && "⚠ Upload failed — check Storage rules/connection."}
                    {upload360State === "idle" && !photo360Path && "No 360° photo set yet."}
                  </span>
                </label>
                <p className="field-hint">
                  Used by the mobile app's AR placard scanner — separate from the room photo above.
                </p>
                <div className="room-editor-photo-preview-box">
                  {photo360Path ? (
                    secure360PhotoUrl
                      ? <img src={secure360PhotoUrl} alt={`${selectedRoom} 360°`} className="photo-preview" />
                      : <p className="field-hint">Loading photo…</p>
                  ) : (
                    <p className="field-hint">No photo yet</p>
                  )}
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button
                className="primary"
                onClick={handleSave}
                disabled={saving || uploadState === "uploading" || upload360State === "uploading"}
              >
                {saving ? "Saving…" : savedFlash ? "✓ Saved" : "Save"}
              </button>
              <button onClick={resetFromSaved}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {sidebar}
    </div>
  );
}
