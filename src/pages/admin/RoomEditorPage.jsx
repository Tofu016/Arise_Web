import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import NodeList from "../../components/NodeList";
import RoomList from "../../components/RoomList";
import FilterPanel from "../../components/FilterPanel";
import FilePickerButton from "../../components/FilePickerButton";
import { usePlacardDialogs } from "../../hooks/usePlacardDialogs";
import { useSecurePhotoUrl } from "../../hooks/useSecurePhotoUrl";
import { useBlurReview } from "../../hooks/useBlurReview";
import { photoFilename, uploadPhoto } from "../../utils/photoStore";
import { useToast } from "../../context/ToastContext";
import IconPlaceholder from "../../components/IconPlaceholder";
import linkIcon from "../../assets/icons/link.svg";
import { listAllRooms, namesOfKind } from "../../utils/search";
import { allBuildings, buildingLabel, floorLabel } from "../../utils/constants";

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

// Checks whether newName is already used by any room or facility on any
// node — since the name is the key that links a node's "Rooms served" entry
// (or a facility marker's label) to its placardDialogs record, two entries
// silently sharing a name would share one record, and break both search and
// the mobile app's OCR matching, unable to tell which one is the "real"
// match. currentNodeId/currentRoomName are excluded from the check — renaming
// to the name it already has (a no-op) shouldn't conflict with itself.
function isRoomNameTaken(newName, nodes, currentNodeId, currentRoomName) {
  const key = normalize(newName);
  for (const n of nodes) {
    for (const kind of ["room", "facility"]) {
      for (const r of namesOfKind(n, kind)) {
        if (n.id === currentNodeId && normalize(r) === normalize(currentRoomName)) continue;
        if (normalize(r) === key) return true;
      }
    }
  }
  return false;
}

const LIST_MODES = [
  { id: "rooms", label: "Rooms and Facilities" },
  { id: "nodes", label: "Nodes" },
];

// A facility is a facility marker on a node, not a "Rooms served" entry, but
// it has the same details record as a room (keyed by name, here the marker's
// label) and the same public panel. So this page edits both: a (node, name)
// selection is a room when the node serves that name, otherwise a facility.
// A facility cannot move to another node here (it is placed in one node's
// panorama), and renaming one relabels its marker instead of "Rooms served".
//
// Promoted from the old RoomEditPanel modal to a full page. Which node's
// rooms are being edited is the SAME shared selectedNodeId every other
// section uses — picking a node from this page's own Node List (or from
// Node Editor/Navigation Editor earlier) all point at the same node here.
// A room can be reached two ways: straight from the Rooms list, or through
// its node in the Nodes list (the row, or one of its room pills). Either
// way a selection is a (node, room) pair.
export default function RoomEditorPage() {
  const { nodes, selectedNodeId, setSelectedNodeId, updateNode, setMarkers } = useOutletContext();
  const { getForRoom, saveRoomDialog } = usePlacardDialogs();
  const toast = useToast();

  const node = nodes.find((n) => n.id === selectedNodeId) || null;
  const servedRooms = node?.rooms || [];
  const facilities = node ? namesOfKind(node, "facility").filter((f) => !servedRooms.includes(f)) : [];
  const rooms = [...servedRooms, ...facilities];

  const [filters, setFilters] = useState(defaultFilters);
  const [listMode, setListMode] = useState("rooms");
  const [selectedRoom, setSelectedRoom] = useState(rooms[0] || null);
  // Picking a node falls back to its first room, unless the room was
  // picked along with it (handleSelectRoom sets both in one render).
  useEffect(() => {
    setSelectedRoom((cur) => (cur && rooms.includes(cur) ? cur : rooms[0] || null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id]);

  const handleSelectRoom = (nodeId, roomName) => {
    setSelectedNodeId(nodeId);
    setSelectedRoom(roomName);
  };

  const existing = selectedRoom ? getForRoom(selectedRoom) : null;
  const isFacility = !!selectedRoom && facilities.includes(selectedRoom);
  const kindName = isFacility ? "Facility" : "Room";

  const [roomTitle, setRoomTitle] = useState(selectedRoom || "");
  const [roomNodeId, setRoomNodeId] = useState(node?.id || "");
  const [description, setDescription] = useState("");
  const [department, setDepartment] = useState("");
  const [contactNumber, setContactNumber] = useState("");
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
    setRoomNodeId(node?.id || "");
    setDescription(existing?.roomDescription || "");
    setDepartment(existing?.department || "");
    setContactNumber(existing?.contactNumber || "");
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
  }, [selectedRoom, existing?.id, node?.id]);

  const { requestBlur, reblurStored, blurDialog } = useBlurReview();
  // Bumped when a stored photo is edited in place (same path, new bytes), so
  // the preview reloads.
  const [photoVersion, setPhotoVersion] = useState(0);
  const [photo360Version, setPhoto360Version] = useState(0);

  const { url: securePhotoUrl } = useSecurePhotoUrl(photoPath, { version: photoVersion });
  const { url: secure360PhotoUrl } = useSecurePhotoUrl(photo360Path, { version: photo360Version });

  // "Edit blur regions" on an already-saved photo. Saves straight over it;
  // if that ever lands on a different path (old .jpg re-saved as .webp) the
  // field adopts the new one, and Save then stores it on the room.
  const handleReblur = async (path, setPath, setVersion) => {
    try {
      const saved = await reblurStored(path);
      if (!saved) return;
      setPath(saved.path);
      setVersion((v) => v + 1);
      toast.success("Blur regions updated.");
    } catch (err) {
      toast.error(err.message || "Couldn't update the photo.");
    }
  };

  const handleFilePick = async (e) => {
    const input = e.target;
    const file = input.files?.[0];
    input.value = ""; // so picking the same file again (e.g. after Cancel) still fires
    if (!file || !selectedRoom || !node) return;
    const filename = photoFilename(file, slugify(selectedRoom));
    try {
      const reviewed = await requestBlur(file); // blur review first; null = cancelled
      if (!reviewed) return;
      setUploadState("uploading");
      const { path } = await uploadPhoto("roomPhoto", reviewed, { building: node.building, filename });
      setPhotoPath(path);
      setUploadState("done");
      setTimeout(() => setUploadState((s) => (s === "done" ? "idle" : s)), 2500);
    } catch (err) {
      setUploadState("error");
      toast.error(err.message || "Couldn't upload the room photo.");
    }
  };

  const handle360FilePick = async (e) => {
    const input = e.target;
    const file = input.files?.[0];
    input.value = "";
    if (!file || !selectedRoom || !node) return;
    const filename = photoFilename(file, slugify(selectedRoom));
    try {
      const reviewed = await requestBlur(file);
      if (!reviewed) return;
      setUpload360State("uploading");
      const { path } = await uploadPhoto("room360", reviewed, { building: node.building, filename });
      setPhoto360Path(path);
      setUpload360State("done");
      setTimeout(() => setUpload360State((s) => (s === "done" ? "idle" : s)), 2500);
    } catch (err) {
      setUpload360State("error");
      toast.error(err.message || "Couldn't upload the 360° room photo.");
    }
  };

  const handleSave = async () => {
    if (!selectedRoom || !node || uploadState === "uploading" || upload360State === "uploading") return;

    const trimmedTitle = roomTitle.trim();
    const isRenaming = trimmedTitle !== selectedRoom;
    const targetNode = isFacility ? node : nodes.find((n) => n.id === roomNodeId) || node;
    const isMoving = targetNode.id !== node.id;

    if (isRenaming) {
      if (!trimmedTitle) {
        alert(`${kindName} title can't be empty.`);
        return;
      }
      if (isRoomNameTaken(trimmedTitle, nodes, node.id, selectedRoom)) {
        alert(`"${trimmedTitle}" is already used by another room or facility. Names must be unique.`);
        return;
      }
    }

    setSaving(true);
    try {
      if (isFacility) {
        // A facility's name is its marker's label. Every facility marker on
        // this node with the old label takes the new one together, so none
        // is left pointing at a record that no longer matches.
        if (isRenaming) {
          await setMarkers(
            node.id,
            (node.markers || []).map((m) => (m.type === "facility" && (m.label || "").trim() === selectedRoom ? { ...m, label: trimmedTitle } : m))
          );
        }
      } else if (isMoving) {
        // Added to the new node before it leaves the old one: if the second
        // write fails the room is listed twice (fixable here) rather than
        // on no node at all. Its saved details are keyed by room name, not
        // node, so they follow it with no extra write.
        await updateNode(targetNode.id, { rooms: [...(targetNode.rooms || []), trimmedTitle] });
        await updateNode(node.id, { rooms: (node.rooms || []).filter((r) => r !== selectedRoom) });
      } else if (isRenaming) {
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
      // place, same record, not a new one, since the record's own id is
      // never tied to the room name.
      await saveRoomDialog(selectedRoom, {
        roomName: trimmedTitle,
        roomDescription: description.trim(),
        department: department.trim(),
        contactNumber: contactNumber.trim(),
        link: link.trim(),
        photo: photoPath,
        photo360: photo360Path,
        ocrSearchTerms: ocrTerm ? [ocrTerm] : [],
      });

      if (isMoving) setSelectedNodeId(targetNode.id);
      if (isRenaming || isMoving) setSelectedRoom(trimmedTitle);

      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
      toast.success(`${kindName} "${trimmedTitle}" saved.`);
    } catch (err) {
      toast.error(err.message || "Couldn't save room details.");
    } finally {
      setSaving(false);
    }
  };

  // The Node picker's options, grouped by building in sidebar order. A
  // node on a building that's no longer listed still needs an option, or
  // the picker can't show the node its room is actually on.
  const buildings = allBuildings();
  const nodeOptionGroups = [
    ...buildings.map((b) => ({ id: b.id, label: b.label, nodes: nodes.filter((n) => n.building === b.id) })),
    { id: "__other", label: "Other", nodes: nodes.filter((n) => !buildings.some((b) => b.id === n.building)) },
  ].filter((g) => g.nodes.length > 0);

  // Takes the place of the list's usual counts header: which list the
  // sidebar shows matters more on this page than how many have photos.
  const listHeader = (
    <div className="node-list-header">
      <div className="room-editor-list-mode" role="group" aria-label="List">
        {LIST_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={"room-editor-list-mode-opt" + (listMode === m.id ? " room-editor-list-mode-opt-active" : "")}
            aria-pressed={listMode === m.id}
            onClick={() => setListMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );

  // Not memoized: room details come from usePlacardDialogs, whose list is
  // deliberately not exposed, so no dependency changes when a save lands.
  // Its refresh re-renders this page, which rebuilds this.
  const allRooms = listAllRooms(nodes, getForRoom);

  const sidebar = (
    <div className="room-editor-sidebar">
      <FilterPanel filters={filters} onChange={setFilters} />
      {listMode === "rooms" ? (
        <RoomList
          rooms={allRooms}
          filters={filters}
          selectedNodeId={selectedNodeId}
          selectedRoom={selectedRoom}
          onSelectRoom={handleSelectRoom}
          header={listHeader}
        />
      ) : (
        <NodeList
          nodes={nodes}
          filters={filters}
          selectedNodeId={selectedNodeId}
          onSelect={setSelectedNodeId}
          selectedRoom={selectedRoom}
          onSelectRoom={handleSelectRoom}
          header={listHeader}
        />
      )}
    </div>
  );

  return (
    <div className="room-editor-page">
      <div className="room-editor-main">
        <h2 className="admin-page-heading">Room and Facility Editor</h2>

        {!node && (
          <p className="empty-hint">Select a room, a facility or a node from the list on the right first.</p>
        )}

        {node && rooms.length === 0 && (
          <p className="empty-hint">
            "{node.name}" has no rooms or facilities yet. Add a room under "Rooms served" in Node Editor, or a
            facility marker in Virtual Map Navigation Editor, first.
          </p>
        )}

        {node && rooms.length > 0 && (
          <div className="room-editor-form-wrap room-edit-modal">
            <div className="room-editor-node-heading">
              <h3>
                {selectedRoom && <span className="room-editor-node-room">{selectedRoom}</span>}
                <span className="room-editor-node-name">({node.name})</span>
              </h3>
              <span className="room-editor-node-meta">
                {buildingLabel(node.building)} · {floorLabel(node.floor)} · {node.id}
              </span>
            </div>

            {rooms.length > 1 && (
              <div className="room-edit-tabs">
                {rooms.map((r) => (
                  <button
                    key={r}
                    className={"room-edit-tab" + (r === selectedRoom ? " room-edit-tab-active" : "")}
                    onClick={() => setSelectedRoom(r)}
                  >
                    {r}{facilities.includes(r) && <span className="room-edit-tab-kind"> (facility)</span>}
                  </button>
                ))}
              </div>
            )}

            {/* Top row: title/description (left) and department/contact number/link
                (right) side by side. Bottom row: both photo choosers side
                by side, spanning the full width — a different split from
                the previous "all text left, both photos right" layout. */}
            <div className="room-editor-top-row">
              <div className="room-editor-top-col">
                <label>
                  {kindName} title
                  <input type="text" value={roomTitle} onChange={(e) => setRoomTitle(e.target.value)} />
                </label>
                <p className="field-hint">
                  {isFacility
                    ? "Renaming here updates this facility's marker label and its saved details together; "
                    : 'Renaming here updates both "Rooms served" on this node and this room\'s saved details together; '}
                  names must stay unique across every room and facility on campus.
                </p>

                <label>
                  Node
                  <select value={roomNodeId} onChange={(e) => setRoomNodeId(e.target.value)} disabled={isFacility}>
                    {nodeOptionGroups.map((g) => (
                      <optgroup key={g.id} label={g.label}>
                        {g.nodes.map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.name} ({floorLabel(n.floor)}, {n.id})
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <p className="field-hint">
                  {isFacility
                    ? "A facility stays on the node whose panorama its marker is placed in. Move the marker itself in Virtual Map Navigation Editor."
                    : "Where this room is reached from. Choosing another node moves the room to that node's \"Rooms served\" on Save; its details and photos come with it."}
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
                  <IconPlaceholder name="call" /> Contact number
                  <input
                    type="tel"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    placeholder="e.g. (02) 8123-4567 loc. 210"
                    maxLength={50}
                  />
                </label>
                <p className="field-hint">Optional: shown on the public panel.</p>

                <label>
                  <img src={linkIcon} alt="" className="icon-placeholder-img" /> Link
                  <input
                    type="text"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="https://…"
                    className="room-edit-link-input"
                  />
                </label>
                <p className="field-hint">Optional: shown as a clickable link on the public panel.</p>
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
                    {uploadState === "error" && "⚠ Upload failed: check your connection."}
                    {uploadState === "idle" && !photoPath && "No photo set yet."}
                  </span>
                </label>
                {photoPath && (
                  <button
                    type="button"
                    className="rescan-faces-btn"
                    onClick={() => handleReblur(photoPath, setPhotoPath, setPhotoVersion)}
                    disabled={uploadState === "uploading"}
                  >
                    <IconPlaceholder name="edit-pencil" /> Edit blur regions on this photo
                  </button>
                )}
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
                    {upload360State === "error" && "⚠ Upload failed: check your connection."}
                    {upload360State === "idle" && !photo360Path && "No 360° photo set yet."}
                  </span>
                </label>
                <p className="field-hint">
                  Used by the mobile app's AR placard scanner, separate from the room photo above.
                </p>
                {photo360Path && (
                  <button
                    type="button"
                    className="rescan-faces-btn"
                    onClick={() => handleReblur(photo360Path, setPhoto360Path, setPhoto360Version)}
                    disabled={upload360State === "uploading"}
                  >
                    <IconPlaceholder name="edit-pencil" /> Edit blur regions on this photo
                  </button>
                )}
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
      {blurDialog}
    </div>
  );
}
