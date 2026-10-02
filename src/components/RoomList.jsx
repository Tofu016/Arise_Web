import { buildingLabel, floorLabel } from "../utils/constants";
import EntityListPanel from "./EntityListPanel";
import { rankRoomMatches, roomKey } from "../utils/search";

// The Room Editor's standalone room lookup: every room on campus as its own
// row, rather than reached through its node (NodeList's pills cover that).
// `rooms` comes from listAllRooms. Building, floor and type narrow by the
// room's node; photo status means the room's own photo here, not the
// node's panorama, since that's the photo this page edits.
export default function RoomList({ rooms, filters, selectedNodeId, selectedRoom, onSelectRoom, header }) {
  const inScope = rooms.filter(({ node, placard }) => {
    if (filters.building !== "all" && node.building !== filters.building) return false;
    if (filters.floor !== "all" && String(node.floor) !== String(filters.floor)) return false;
    if (filters.type !== "all" && node.type !== filters.type) return false;
    if (filters.photoStatus === "missing" && placard?.photo) return false;
    if (filters.photoStatus === "has" && !placard?.photo) return false;
    return true;
  });
  const items = rankRoomMatches(filters.search, inScope).map((r) => ({
    ...r,
    id: roomKey(r.node.id, r.roomName),
    name: r.roomName,
    photo: r.placard?.photo,
  }));
  const byId = new Map(items.map((it) => [it.id, it]));

  return (
    <EntityListPanel
      label="Rooms"
      allItems={rooms}
      filteredItems={items}
      selectedId={selectedRoom ? roomKey(selectedNodeId, selectedRoom) : null}
      onSelect={(id) => {
        const it = byId.get(id);
        onSelectRoom(it.node.id, it.roomName);
      }}
      renderMeta={({ node }) => (
        <>
          {buildingLabel(node.building)} · {floorLabel(node.floor)} · {node.name}
        </>
      )}
      renderExtra={({ placard }) =>
        placard?.department && <div className="node-row-meta">{placard.department}</div>
      }
      emptyMessage={rooms.length ? "No rooms match this filter." : 'No rooms yet. Add one under "Rooms served" in Node Editor.'}
      header={header}
    />
  );
}
