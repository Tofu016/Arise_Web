import { listedRooms, roomsInBuilding } from "./directorySettings";
import { roomPhotos } from "./roomPhotos";

// The order the directory's cell photos are warmed in: the first
// `perBuilding` listed rooms of every visible building (in `buildings`
// order) come first, so each building opens with its top cells already
// loaded, then everything else. Only each room's first photo (the cell's
// thumbnail) is needed, and a room without photos is skipped (but still counts
// as one of the first few). Returns { first, rest }, each a list of photos
// ({ path, kind, ... }).
export function planDirectoryPreload(rooms, buildings, settings, perBuilding = 4) {
  const first = [];
  const rest = [];
  const seen = new Set();
  for (const building of buildings) {
    if (settings.hiddenBuildings.includes(building.id)) continue;
    const listed = listedRooms(settings, building.id, roomsInBuilding(rooms, building.id));
    listed.forEach((room, i) => {
      const photo = roomPhotos(room.placard)[0];
      if (!photo || seen.has(photo.path)) return;
      seen.add(photo.path);
      (i < perBuilding ? first : rest).push(photo);
    });
  }
  return { first, rest };
}
