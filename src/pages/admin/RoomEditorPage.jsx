import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import NodeList from "../../components/NodeList";
import RoomList from "../../components/RoomList";
import FilterPanel from "../../components/FilterPanel";
import { usePlacardDialogs, deleteDialogsByName } from "../../hooks/usePlacardDialogs";
import { useRoomPhotoUploads } from "../../hooks/useRoomPhotoUploads";
import RoomDetailsForm from "../../components/admin/RoomDetailsForm";
import CreateRoomDialog from "../../components/admin/CreateRoomDialog";
import { useToast } from "../../context/ToastContext";
import { listAllRooms, namesOfKind, isRoomNameTaken } from "../../utils/search";
import { markersAfterSave } from "../../utils/roomMarkers";
import { buildingLabel, floorLabel } from "../../utils/constants";
import { useConfirm } from "../../context/useConfirm";

const defaultFilters = {
  building: "all",
  floor: "all",
  type: "all",
  photoStatus: "all",
  search: "",
};

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
  const { alert, confirm } = useConfirm();
  const { nodes, selectedNodeId, setSelectedNodeId, updateNode, setMarkers } = useOutletContext();
  const { getForRoom, saveRoomDialog, refresh: refreshDialogs } = usePlacardDialogs();
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

  const kind = isFacility ? "facility" : "room";
  const [showCreate, setShowCreate] = useState(false);

  // The form's draft (see RoomDetailsForm). Its marker placement is part of
  // it, so a marker moved here is written on Save and undone by Cancel,
  // like every other field.
  const savedDraft = () => ({
    title: selectedRoom || "",
    nodeId: node?.id || "",
    description: existing?.roomDescription || "",
    department: existing?.department || "",
    contactNumber: existing?.contactNumber || "",
    link: existing?.link || "",
    photos: existing?.photos || [],
    markerPlacement: null,
  });
  const [draft, setDraft] = useState(savedDraft);
  const setPhotos = (update) => setDraft((d) => ({ ...d, photos: typeof update === "function" ? update(d.photos) : update }));
  const photoUploads = useRoomPhotoUploads(setPhotos);
  const { uploadState, setUploadState } = photoUploads;
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // Shared by the initial load AND the "Cancel" button below — Cancel
  // just re-runs this same reset, discarding any unsaved edits back to
  // whatever's actually on record. There's no "close to" destination for
  // a full page the way a modal had, so reverting the form in place is
  // the sensible reading of what Cancel means here.
  const resetFromSaved = () => {
    setDraft(savedDraft());
    setUploadState("idle");
    setSavedFlash(false);
  };

  // Load whatever's already on record for the selected room every time the
  // room (or its underlying data) changes.
  useEffect(() => {
    resetFromSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoom, existing?.id, node?.id]);

  const handleFilesPick = (e) => {
    if (!selectedRoom || !node) return;
    photoUploads.pickFiles(e, { name: selectedRoom, building: node.building });
  };

  const handleSave = async () => {
    if (!selectedRoom || !node || uploadState === "uploading") return;

    const trimmedTitle = draft.title.trim();
    const isRenaming = trimmedTitle !== selectedRoom;
    const targetNode = isFacility ? node : nodes.find((n) => n.id === draft.nodeId) || node;
    const isMoving = targetNode.id !== node.id;
    const placement = draft.markerPlacement;

    if (isRenaming) {
      if (!trimmedTitle) {
        alert({ title: "Title required", message: `${kindName} title can't be empty.` });
        return;
      }
      if (isRoomNameTaken(trimmedTitle, nodes, node.id, selectedRoom)) {
        alert({ title: "Name already in use", message: `"${trimmedTitle}" is already used by another room or facility. Names must be unique.` });
        return;
      }
    }

    // No OCR fields here: the scanner matches a room by its Placard name
    // and search terms, which the OCR Management page owns, and a rename
    // here leaves them alone (that page flags the names drifting apart).
    //
    // saveRoomDialog looks the existing record up by the OLD name
    // (selectedRoom) — passing the new name in the patch renames it in
    // place, same record, not a new one, since the record's own id is
    // never tied to the room name.
    const saveDetails = () =>
      saveRoomDialog(selectedRoom, {
        roomName: trimmedTitle,
        roomDescription: draft.description.trim(),
        department: draft.department.trim(),
        contactNumber: draft.contactNumber.trim(),
        link: draft.link.trim(),
        photos: draft.photos,
      });

    setSaving(true);
    try {
      if (isFacility) {
        // A facility's name is its marker's label. Its details are renamed
        // first: a marker change deletes the details of any facility name it
        // leaves behind, which would otherwise be this record, mid-rename.
        // Every facility marker on this node with the old label takes the
        // new one together, so none is left pointing at a stale record.
        await saveDetails();
        const markers = markersAfterSave(node, { kind, oldName: selectedRoom, newName: trimmedTitle, placement });
        if (markers) await setMarkers(node.id, markers);
      } else {
        if (isMoving) {
          // Added to the new node before it leaves the old one: if the second
          // write fails the room is listed twice (fixable here) rather than
          // on no node at all. Its saved details are keyed by room name, not
          // node, so they follow it with no extra write. Its marker can't
          // follow (it was placed in the old node's photo), so it is removed
          // there, and placed anew on the new node if one was picked.
          await updateNode(targetNode.id, { rooms: [...(targetNode.rooms || []), trimmedTitle] });
          await updateNode(node.id, { rooms: (node.rooms || []).filter((r) => r !== selectedRoom) });
          const left = markersAfterSave(node, { kind, oldName: selectedRoom, remove: true });
          if (left) await setMarkers(node.id, left);
        } else if (isRenaming) {
          // Replace the old name with the new one at the same position,
          // leaving every other room on this node untouched.
          await updateNode(node.id, { rooms: (node.rooms || []).map((r) => (r === selectedRoom ? trimmedTitle : r)) });
        }
        // A room marker reads the room's name, so a rename relabels it too.
        const markers = markersAfterSave(targetNode, { kind, oldName: selectedRoom, newName: trimmedTitle, placement });
        if (markers) await setMarkers(targetNode.id, markers);
        await saveDetails();
      }

      if (isMoving) setSelectedNodeId(targetNode.id);
      if (isRenaming || isMoving) setSelectedRoom(trimmedTitle);
      // Nothing re-keys on a marker-only save, so drop the placement here;
      // the marker itself now shows where it was put.
      setDraft((d) => ({ ...d, markerPlacement: null }));

      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
      toast.success(`${kindName} "${trimmedTitle}" saved.`);
    } catch (err) {
      toast.error(err.message || "Couldn't save room details.");
    } finally {
      setSaving(false);
    }
  };

  // Removes the room or facility everywhere it lives: its marker(s) on this
  // node, its "Rooms served" entry (a room only; a facility is just its
  // marker) and its saved details. A facility's details are dropped by
  // setMarkers itself once nothing else uses the name.
  const handleDelete = async () => {
    if (!selectedRoom || !node || saving) return;
    const ok = await confirm({
      title: `Delete ${kind}?`,
      message: `Delete ${kind} "${selectedRoom}" from "${node.name}"? This also removes its marker and its saved details, photos and contact info.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;

    setSaving(true);
    try {
      const left = markersAfterSave(node, { kind, oldName: selectedRoom, remove: true });
      if (left) await setMarkers(node.id, left);
      if (!isFacility) {
        await updateNode(node.id, { rooms: servedRooms.filter((r) => r !== selectedRoom) });
        await deleteDialogsByName([selectedRoom]);
      }
      await refreshDialogs();
      setSelectedRoom(rooms.find((r) => r !== selectedRoom) || null);
      toast.success(`${kindName} "${selectedRoom}" deleted.`);
    } catch (err) {
      toast.error(err.message || `Couldn't delete the ${kind}.`);
    } finally {
      setSaving(false);
    }
  };

  const handleCreated = (nodeId, name) => {
    setShowCreate(false);
    setListMode("rooms");
    handleSelectRoom(nodeId, name);
  };

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
        <div className="room-editor-header">
          <h2 className="admin-page-heading">Room and Facility Editor</h2>
          <button type="button" className="primary room-editor-create-btn" onClick={() => setShowCreate(true)}>
            + New Room or Facility
          </button>
        </div>

        {!node && (
          <p className="empty-hint">Select a room, a facility or a node from the list on the right, or create a new one.</p>
        )}

        {node && rooms.length === 0 && (
          <p className="empty-hint">
            "{node.name}" has no rooms or facilities yet. Create one with "New Room or Facility" above.
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

            <RoomDetailsForm
              draft={draft}
              onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
              kind={kind}
              nodes={nodes}
              nodeDisabled={isFacility}
              titleHint={
                (isFacility
                  ? "Renaming here updates this facility's marker label and its saved details together; "
                  : 'Renaming here updates "Rooms served" on this node, the room\'s marker and its saved details together; ') +
                "names must stay unique across every room and facility on campus."
              }
              nodeHint={
                isFacility
                  ? "A facility stays on the node whose panorama its marker is placed in. Move the marker below, or in Navigation Editor."
                  : 'Where this room is reached from. Choosing another node moves the room to that node\'s "Rooms served" on Save; its details and photos come with it, and its marker is placed anew there.'
              }
              markerRoomName={draft.nodeId === node.id ? selectedRoom : null}
              markerFocusKey={selectedRoom}
              photoUploads={photoUploads}
              onFilesPick={handleFilesPick}
            />

            <div className="form-actions">
              <button
                className="primary"
                onClick={handleSave}
                disabled={saving || uploadState === "uploading"}
              >
                {saving ? "Saving…" : savedFlash ? "✓ Saved" : "Save"}
              </button>
              <button
                onClick={() => {
                  resetFromSaved();
                  toast.info("Changes cancelled.");
                }}
              >
                Cancel
              </button>
              {/* Last, after Cancel, so a stray click on the way to Save or Cancel can't hit it. */}
              <button className="danger" onClick={handleDelete} disabled={saving || uploadState === "uploading"}>
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {sidebar}
      {photoUploads.blurDialog}
      {showCreate && (
        <CreateRoomDialog
          nodes={nodes}
          initialNodeId={selectedNodeId}
          updateNode={updateNode}
          setMarkers={setMarkers}
          saveRoomDialog={saveRoomDialog}
          onCreated={handleCreated}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
