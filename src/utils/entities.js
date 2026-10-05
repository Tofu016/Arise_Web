// Wire <-> domain mapping for every entity, in one place: the backend's
// snake_case rows become the camelCase objects the app uses, and the
// app's drafts/patches become request bodies. Pure functions — no fetch,
// no React — so each mapping is testable by calling it.
//
// Empty-value conventions are the backend contract, not tidiness, and are
// deliberately left as each entity has them: photo fields are "" when
// empty. Create bodies drop empty optionals (`|| undefined`); patch
// bodies send exactly what was given.

// A hotspot's defaultYaw/defaultPitch are the arrival view for that one
// edge — the camera orientation to land on when walking this specific
// link, independent of the arrow's own yaw/pitch. Null (not set) means
// "no override".
function toEdges(neighborRows) {
  const hotspots = {};
  const neighbors = (neighborRows || []).map((n) => {
    hotspots[n.neighbor_id] = {
      // The API sends MySQL floats as strings; angle math (`yaw + 180`) would
      // concatenate instead of add.
      yaw: Number(n.yaw),
      pitch: Number(n.pitch),
      defaultYaw: n.default_yaw == null ? null : Number(n.default_yaw),
      defaultPitch: n.default_pitch == null ? null : Number(n.default_pitch),
    };
    return n.neighbor_id;
  });
  return { neighbors, hotspots };
}

function toMarker(m) {
  return { id: m.id, type: m.type, label: m.label, yaw: m.yaw, pitch: m.pitch };
}

// Elevator markers are a Node-only concept (see utils/elevators.js).
// accessibleFloors (and an elevator marker's label) are read-time
// copies joined from the one `elevators` row, never stored per marker, so
// every landing of the same elevator always agrees. An emergency exit marker
// carries `landings`: the node ids its hidden fire stairs come out at, lowest
// floor first (see utils/emergencyExits.js).
function toNodeMarker(m) {
  return {
    ...toMarker(m),
    elevatorId: m.elevator_id ?? null,
    accessibleFloors: (m.accessible_floors || []).map(Number),
    landings: m.landings || [],
  };
}

// Only the fields present in `patch`, under their wire names. `fields`
// maps patch key -> wire key.
function pick(patch, fields) {
  const body = {};
  for (const [key, wireKey] of Object.entries(fields)) {
    if (patch[key] !== undefined) body[wireKey] = patch[key];
  }
  return body;
}

// ---- Node (indoor panorama point) ----

export function toNode(row) {
  return {
    id: row.id,
    name: row.name,
    building: row.building,
    floor: Number(row.floor),
    type: row.type,
    startingNode: Number(row.is_starting_node) === 1,
    // The view to land on when a visitor is dropped onto this node from
    // the floor/building picker (only meaningful while startingNode is
    // true, but kept regardless in case a node becomes one later).
    startingViewYaw: row.starting_view_yaw ?? null,
    startingViewPitch: row.starting_view_pitch ?? null,
    // The single node representing this node's whole campus (GD1/GD2/GD3
    // share one, Digital Campus has its own) — drives the cross-campus
    // minimap. At most one true per campus, enforced server-side.
    campusEntrance: Number(row.is_campus_entrance) === 1,
    // The single node representing this node's own building — narrower
    // than campusEntrance (which can span GD1/GD2/GD3). Independent flag:
    // a node can be both, either, or neither. At most one true per
    // building, enforced server-side.
    buildingEntrance: Number(row.is_building_entrance) === 1,
    // An admin's statement that someone who reaches this node is out of
    // danger: what makes it an Emergency Exit Destination Point, the end of
    // the Nearest Exit route (see utils/evacuation.js). Unticked until set.
    isEmergencyDestination: Number(row.is_emergency_destination) === 1,
    photo: row.photo_path || "",
    rooms: (row.rooms || []).map((r) => r.room_name),
    ...toEdges(row.neighbors),
    markers: (row.markers || []).map(toNodeMarker),
    flowchartPosition:
      row.flowchart_position_x != null && row.flowchart_position_y != null
        ? { x: row.flowchart_position_x, y: row.flowchart_position_y }
        : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function nodeCreateBody(item) {
  return {
    id: item.id,
    name: item.name,
    building: item.building,
    floor: item.floor,
    type: item.type,
    photo_path: item.photo || undefined,
  };
}

export function nodePatchBody(patch) {
  const body = pick(patch, {
    name: "name",
    building: "building",
    floor: "floor",
    type: "type",
    photo: "photo_path",
  });
  if (patch.startingNode !== undefined) body.is_starting_node = patch.startingNode ? 1 : 0;
  if (patch.startingViewYaw !== undefined) body.starting_view_yaw = patch.startingViewYaw;
  if (patch.startingViewPitch !== undefined) body.starting_view_pitch = patch.startingViewPitch;
  if (patch.campusEntrance !== undefined) body.is_campus_entrance = patch.campusEntrance ? 1 : 0;
  if (patch.buildingEntrance !== undefined) body.is_building_entrance = patch.buildingEntrance ? 1 : 0;
  if (patch.isEmergencyDestination !== undefined) body.is_emergency_destination = patch.isEmergencyDestination ? 1 : 0;
  if (patch.flowchartPosition !== undefined) {
    body.flowchart_position_x = patch.flowchartPosition ? patch.flowchartPosition.x : null;
    body.flowchart_position_y = patch.flowchartPosition ? patch.flowchartPosition.y : null;
  }
  return body;
}

// ---- Elevator (the single record every landing marker points at) ----

export function toElevator(row) {
  return {
    id: row.id,
    label: row.label,
    building: row.building,
    accessibleFloors: (row.accessible_floors || []).map(Number).sort((a, b) => a - b),
    landings: (row.landings || []).map((l) => ({ markerId: l.marker_id, nodeId: l.node_id, floor: Number(l.floor) })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function elevatorCreateBody({ id, label, building, accessibleFloors }) {
  return { id, label, building, accessible_floors: accessibleFloors };
}

// Building and id are fixed once created (landings are validated against
// them), so only label and floors are patchable.
export function elevatorPatchBody(patch) {
  return pick(patch, { label: "label", accessibleFloors: "accessible_floors" });
}

// ---- Admin ----

// An admin account as the User Panel shows it. `uid` aliases the backend's
// `id`, matching the naming the panel uses to spot the signed-in admin.
export function toAdmin(row) {
  return {
    uid: row.id,
    email: row.email,
    name: row.name,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---- Room placard dialog ----

export function normalizeRoomName(name) {
  return (name || "").trim().toUpperCase();
}

export function toDialog(row) {
  return {
    id: row.id,
    roomName: row.room_name,
    roomDescription: row.description || "",
    department: row.department || "",
    contactNumber: row.contact_number || "",
    link: row.link || "",
    // Every photo in the order an admin sorted them, each with its kind
    // ("flat" or "360") and, for a flat one, its square thumbnail focus as CSS
    // object-position percentages (50/50 = the middle of the picture).
    photos: (row.photos || []).map((p) => ({ path: p.path, kind: p.kind === "360" ? "360" : "flat", x: p.thumb_x ?? 50, y: p.thumb_y ?? 50 })),
    // The first photo is the room's thumbnail; "" when it has none.
    photo: row.photos?.[0]?.path || "",
    ocrSearchTerms: (row.search_terms || []).map((t) => t.term),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function dialogPatchBody(patch) {
  const body = pick(patch, {
    roomName: "room_name",
    roomDescription: "description",
    department: "department",
    contactNumber: "contact_number",
    link: "link",
    ocrSearchTerms: "search_terms",
  });
  if (patch.photos) {
    body.photos = patch.photos.map((p) => ({ path: p.path, kind: p.kind, thumb_x: p.x, thumb_y: p.y }));
  }
  return body;
}

// A brand-new record is seeded with an empty description and one search
// term derived from the room name, then the patch applied on top.
export function dialogCreateBody(roomName, patch) {
  const trimmedName = (patch.roomName || roomName).trim();
  const ocrTerm = trimmedName.toLowerCase().replace(/[^a-z0-9]/g, "");
  return {
    room_name: trimmedName,
    description: "",
    search_terms: ocrTerm ? [ocrTerm] : [],
    ...dialogPatchBody(patch),
  };
}

// ---- Signage slide (kiosk bottom-band media, see utils/signage.js) ----

export function toSignageSlide(row) {
  return {
    id: String(row.id),
    title: row.title,
    category: row.category === "starting" ? "starting" : "footer",
    mediaPath: row.media_path,
    crop: { x: Number(row.crop_x), y: Number(row.crop_y), w: Number(row.crop_w), h: Number(row.crop_h) },
    durationSeconds: Number(row.duration_seconds),
    sortOrder: Number(row.sort_order),
    active: Number(row.is_active) === 1,
    startsAt: row.starts_at || null,
    endsAt: row.ends_at || null,
  };
}

// Create and update share one body: the API takes any subset on update
// and requires title/mediaPath on create. The crop always travels as all
// four values (the API refuses a partial one). Dates are null to clear.
export function signageSlideBody(patch) {
  const body = pick(patch, {
    title: "title",
    category: "category",
    mediaPath: "media_path",
    durationSeconds: "duration_seconds",
    active: "is_active",
    startsAt: "starts_at",
    endsAt: "ends_at",
  });
  if (patch.crop) {
    body.crop_x = patch.crop.x;
    body.crop_y = patch.crop.y;
    body.crop_w = patch.crop.w;
    body.crop_h = patch.crop.h;
  }
  return body;
}

export function toSignageSettings(row) {
  return {
    rotationOrder: row.rotation_order,
    transition: row.transition,
    defaultDurationSeconds: Number(row.default_duration_seconds),
  };
}

export function signageSettingsBody(patch) {
  return pick(patch, {
    rotationOrder: "rotation_order",
    transition: "transition",
    defaultDurationSeconds: "default_duration_seconds",
  });
}

export function toDirectorySettings(row) {
  return {
    showSaved: row.show_saved !== false,
    hiddenCampuses: row.hidden_campuses || [],
    hiddenBuildings: row.hidden_buildings || [],
    // An empty map comes back from PHP as an empty list. A map stored by an
    // earlier version (building id to a bare list) is read as no entry.
    buildingRooms: Array.isArray(row.building_rooms) ? {} : row.building_rooms || {},
  };
}

export function directorySettingsBody(patch) {
  return pick(patch, {
    showSaved: "show_saved",
    hiddenCampuses: "hidden_campuses",
    hiddenBuildings: "hidden_buildings",
    buildingRooms: "building_rooms",
  });
}
