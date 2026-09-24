// Wire <-> domain mapping for every entity, in one place: the backend's
// snake_case rows become the camelCase objects the app uses, and the
// app's drafts/patches become request bodies. Pure functions — no fetch,
// no React — so each mapping is testable by calling it.
//
// Empty-value conventions are the backend contract, not tidiness, and are
// deliberately left as each entity has them: photo fields are "" when
// empty, except a section's coverPhoto, which is null. Create bodies drop
// empty optionals (`|| undefined`); patch bodies send exactly what was
// given.

// A hotspot's defaultYaw/defaultPitch are the arrival view for that one
// edge — the camera orientation to land on when walking this specific
// link, independent of the arrow's own yaw/pitch. Null (not set) means
// "no override".
function toEdges(neighborRows) {
  const hotspots = {};
  const neighbors = (neighborRows || []).map((n) => {
    hotspots[n.neighbor_id] = {
      yaw: n.yaw,
      pitch: n.pitch,
      defaultYaw: n.default_yaw ?? null,
      defaultPitch: n.default_pitch ?? null,
    };
    return n.neighbor_id;
  });
  return { neighbors, hotspots };
}

function toMarker(m) {
  return { id: m.id, type: m.type, label: m.label, yaw: m.yaw, pitch: m.pitch };
}

// Elevator markers are a Node-only concept (see utils/elevators.js) — tour
// stops have no floors at all, so toStop() below deliberately doesn't call
// this. accessibleFloors (and an elevator marker's label) are read-time
// copies joined from the one `elevators` row, never stored per marker, so
// every landing of the same elevator always agrees.
function toNodeMarker(m) {
  return {
    ...toMarker(m),
    elevatorId: m.elevator_id ?? null,
    accessibleFloors: (m.accessible_floors || []).map(Number),
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
    floor: row.floor,
    type: row.type,
    leadsToFloors: (row.leads_to_floors || []).map(Number),
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
    leads_to_floors: item.leadsToFloors?.length ? item.leadsToFloors : undefined,
  };
}

export function nodePatchBody(patch) {
  const body = pick(patch, {
    name: "name",
    building: "building",
    floor: "floor",
    type: "type",
    photo: "photo_path",
    leadsToFloors: "leads_to_floors",
  });
  if (patch.startingNode !== undefined) body.is_starting_node = patch.startingNode ? 1 : 0;
  if (patch.startingViewYaw !== undefined) body.starting_view_yaw = patch.startingViewYaw;
  if (patch.startingViewPitch !== undefined) body.starting_view_pitch = patch.startingViewPitch;
  if (patch.campusEntrance !== undefined) body.is_campus_entrance = patch.campusEntrance ? 1 : 0;
  if (patch.buildingEntrance !== undefined) body.is_building_entrance = patch.buildingEntrance ? 1 : 0;
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

// ---- Tour stop (outdoor panorama point) ----

export function toStop(row) {
  return {
    id: row.id,
    name: row.name,
    section: row.section_id || "",
    photo: row.photo_path || "",
    description: row.description || "",
    ...toEdges(row.neighbors),
    markers: (row.markers || []).map((m) => ({
      ...toMarker(m),
      // Backend photos are objects (id, photo_path, sort_order, already in
      // carousel order) — components only ever want plain path strings.
      photos: (m.photos || []).map((p) => p.photo_path),
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function stopCreateBody(item) {
  return {
    id: item.id,
    name: item.name,
    section_id: item.section || undefined,
    photo_path: item.photo || undefined,
    description: item.description || undefined,
  };
}

export function stopPatchBody(patch) {
  const body = pick(patch, { name: "name", photo: "photo_path", description: "description" });
  // "" means "no section" (the form's "— No section —" option), but
  // section_id is a foreign key: the database wants a real id or NULL,
  // never a literal empty string (sending "" caused a 500).
  if (patch.section !== undefined) body.section_id = patch.section || null;
  return body;
}

// ---- Tour section ----

export function toSection(row) {
  return {
    id: row.id,
    label: row.label,
    coverPhoto: row.cover_photo_path || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function sectionCreateBody({ label, coverPhoto }) {
  return { label, cover_photo_path: coverPhoto || undefined };
}

export function sectionPatchBody(patch) {
  return pick(patch, { label: "label", coverPhoto: "cover_photo_path" });
}

// ---- User ----

// `uid` aliases the backend's `id`, matching the naming the app has always
// used (UserPanelPage and AuthContext both compare on it).
export function toUser(row) {
  return {
    uid: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
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
    use: row.use || "",
    link: row.link || "",
    photo: row.photo_path || "",
    photo360: row.photo_360_path || "",
    ocrSearchTerms: (row.search_terms || []).map((t) => t.term),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function dialogPatchBody(patch) {
  return pick(patch, {
    roomName: "room_name",
    roomDescription: "description",
    department: "department",
    use: "use",
    link: "link",
    photo: "photo_path",
    photo360: "photo_360_path",
    ocrSearchTerms: "search_terms",
  });
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
