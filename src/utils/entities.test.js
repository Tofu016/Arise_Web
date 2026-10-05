import { describe, it, expect } from "vitest";
import {
  toNode,
  nodeCreateBody,
  nodePatchBody,
  toStop,
  stopCreateBody,
  stopPatchBody,
  toSection,
  sectionCreateBody,
  sectionPatchBody,
  toAdmin,
  toDialog,
  normalizeRoomName,
  dialogPatchBody,
  dialogCreateBody,
} from "./entities";

const nodeRow = {
  id: "gd1_f1_hall_01",
  name: "Hall",
  building: "gd1",
  floor: 1,
  type: "hallway",
  photo_path: "panoramas/gd1/a.jpg",
  rooms: [{ id: 7, room_name: "101" }, { id: 8, room_name: "102" }],
  neighbors: [{ neighbor_id: "n2", yaw: 90, pitch: -5 }, { neighbor_id: "n3", yaw: 180, pitch: 0 }],
  markers: [{ id: 1, type: "emergency_exit", label: "Assembly Point", yaw: 10, pitch: 2 }],
  flowchart_position_x: 12,
  flowchart_position_y: 34,
  created_at: "c",
  updated_at: "u",
};

describe("starting node", () => {
  it("reads is_starting_node and writes it as 1/0", () => {
    expect(toNode({ id: "x", name: "X", is_starting_node: "1" }).startingNode).toBe(true);
    expect(nodePatchBody({ startingNode: true }).is_starting_node).toBe(1);
    expect(nodePatchBody({ startingNode: false }).is_starting_node).toBe(0);
    expect("is_starting_node" in nodePatchBody({ name: "n" })).toBe(false);
  });
});

describe("campus entrance", () => {
  it("reads is_campus_entrance and writes it as 1/0", () => {
    expect(toNode({ id: "x", name: "X", is_campus_entrance: "1" }).campusEntrance).toBe(true);
    expect(nodePatchBody({ campusEntrance: true }).is_campus_entrance).toBe(1);
    expect(nodePatchBody({ campusEntrance: false }).is_campus_entrance).toBe(0);
    expect("is_campus_entrance" in nodePatchBody({ name: "n" })).toBe(false);
  });
});

describe("building entrance", () => {
  it("reads is_building_entrance and writes it as 1/0", () => {
    expect(toNode({ id: "x", name: "X", is_building_entrance: "1" }).buildingEntrance).toBe(true);
    expect(nodePatchBody({ buildingEntrance: true }).is_building_entrance).toBe(1);
    expect(nodePatchBody({ buildingEntrance: false }).is_building_entrance).toBe(0);
    expect("is_building_entrance" in nodePatchBody({ name: "n" })).toBe(false);
  });
});

describe("emergency destination point", () => {
  it("reads is_emergency_destination and writes it as 1/0", () => {
    expect(toNode({ id: "x", name: "X", is_emergency_destination: "1" }).isEmergencyDestination).toBe(true);
    expect(toNode({ id: "x", name: "X" }).isEmergencyDestination).toBe(false);
    expect(nodePatchBody({ isEmergencyDestination: true }).is_emergency_destination).toBe(1);
    expect(nodePatchBody({ isEmergencyDestination: false }).is_emergency_destination).toBe(0);
    expect("is_emergency_destination" in nodePatchBody({ name: "n" })).toBe(false);
  });
});

describe("toNode", () => {
  it("maps a full row to the app's camelCase node", () => {
    expect(toNode(nodeRow)).toEqual({
      id: "gd1_f1_hall_01",
      name: "Hall",
      building: "gd1",
      floor: 1,
      type: "hallway",
      startingNode: false,
      startingViewYaw: null,
      startingViewPitch: null,
      campusEntrance: false,
      buildingEntrance: false,
      isEmergencyDestination: false,
      photo: "panoramas/gd1/a.jpg",
      rooms: ["101", "102"],
      neighbors: ["n2", "n3"],
      hotspots: {
        n2: { yaw: 90, pitch: -5, defaultYaw: null, defaultPitch: null },
        n3: { yaw: 180, pitch: 0, defaultYaw: null, defaultPitch: null },
      },
      markers: [{ id: 1, type: "emergency_exit", label: "Assembly Point", yaw: 10, pitch: 2, elevatorId: null, accessibleFloors: [], landings: [] }],
      flowchartPosition: { x: 12, y: 34 },
      createdAt: "c",
      updatedAt: "u",
    });
  });

  it("uses safe empties for a bare row", () => {
    const n = toNode({ id: "x", name: "X" });
    expect(n).toMatchObject({ photo: "", rooms: [], neighbors: [], hotspots: {}, markers: [] });
    expect(n.flowchartPosition).toBeNull();
  });

  it("has no flowchart position unless both coordinates are set", () => {
    expect(toNode({ ...nodeRow, flowchart_position_y: null }).flowchartPosition).toBeNull();
    expect(toNode({ ...nodeRow, flowchart_position_x: 0, flowchart_position_y: 0 }).flowchartPosition).toEqual({
      x: 0,
      y: 0,
    });
  });

  it("reads an emergency exit marker's landings, lowest floor first as the backend sends them", () => {
    const n = toNode({
      ...nodeRow,
      markers: [{ id: 4, type: "emergency_exit", label: "Emergency Exit", yaw: 1, pitch: 2, landings: ["g_f1_a", "g_f2_b"] }],
    });
    expect(n.markers[0].landings).toEqual(["g_f1_a", "g_f2_b"]);
  });

  it("gives every marker an empty landings list when the backend sent none", () => {
    expect(toNode(nodeRow).markers.every((m) => Array.isArray(m.landings))).toBe(true);
  });

  it("reads a set starting view, and each edge's own default view", () => {
    const n = toNode({
      ...nodeRow,
      starting_view_yaw: 45,
      starting_view_pitch: -8,
      neighbors: [{ neighbor_id: "n2", yaw: 90, pitch: -5, default_yaw: 12, default_pitch: 3 }],
    });
    expect(n.startingViewYaw).toBe(45);
    expect(n.startingViewPitch).toBe(-8);
    expect(n.hotspots.n2).toEqual({ yaw: 90, pitch: -5, defaultYaw: 12, defaultPitch: 3 });
  });
});

describe("node request bodies", () => {
  it("create drops empty optionals", () => {
    const body = nodeCreateBody({ id: "a", name: "A", building: "gd1", floor: 1, type: "hallway", photo: "" });
    expect(body.photo_path).toBeUndefined();
    expect(body).not.toHaveProperty("leads_to_floors");
    expect(nodeCreateBody({ id: "a", photo: "p" })).toMatchObject({ photo_path: "p" });
  });

  it("patch sends only the fields given, under wire names", () => {
    expect(nodePatchBody({ name: "N", photo: "" })).toEqual({
      name: "N",
      photo_path: "",
    });
    expect(nodePatchBody({})).toEqual({});
  });

  it("patch splits a flowchart position, and nulls both when cleared", () => {
    expect(nodePatchBody({ flowchartPosition: { x: 1, y: 2 } })).toEqual({
      flowchart_position_x: 1,
      flowchart_position_y: 2,
    });
    expect(nodePatchBody({ flowchartPosition: null })).toEqual({
      flowchart_position_x: null,
      flowchart_position_y: null,
    });
  });

  it("patch ignores rooms (synced separately)", () => {
    expect(nodePatchBody({ rooms: ["1"] })).toEqual({});
  });

  it("patch sends the starting view, nulls to clear it", () => {
    expect(nodePatchBody({ startingViewYaw: 45, startingViewPitch: -8 })).toEqual({
      starting_view_yaw: 45,
      starting_view_pitch: -8,
    });
    expect(nodePatchBody({ startingViewYaw: null, startingViewPitch: null })).toEqual({
      starting_view_yaw: null,
      starting_view_pitch: null,
    });
  });
});

describe("tour stops", () => {
  const row = {
    id: "s1",
    name: "Stop",
    section_id: null,
    photo_path: null,
    description: null,
    neighbors: [{ neighbor_id: "s2", yaw: 1, pitch: 2 }],
    created_at: "c",
    updated_at: "u",
  };

  it("maps empties to empty strings", () => {
    expect(toStop(row)).toEqual({
      id: "s1",
      name: "Stop",
      section: "",
      photo: "",
      coverPhoto: "",
      description: "",
      neighbors: ["s2"],
      hotspots: { s2: { yaw: 1, pitch: 2, defaultYaw: null, defaultPitch: null } },
      createdAt: "c",
      updatedAt: "u",
    });
  });

  it("create drops empty optionals", () => {
    const body = stopCreateBody({ id: "s", name: "S", section: "", photo: "", coverPhoto: "", description: "" });
    expect(body).toEqual({
      id: "s",
      name: "S",
      section_id: undefined,
      photo_path: undefined,
      cover_photo_path: undefined,
      description: undefined,
    });
  });

  it("maps the cover photo both ways", () => {
    expect(toStop({ ...row, cover_photo_path: "tourcover/s1_cover.webp" }).coverPhoto).toBe("tourcover/s1_cover.webp");
    expect(stopCreateBody({ id: "s", name: "S", coverPhoto: "tourcover/s_cover.webp" }).cover_photo_path).toBe(
      "tourcover/s_cover.webp"
    );
    expect(stopPatchBody({ coverPhoto: "" })).toEqual({ cover_photo_path: "" });
  });

  it("patch sends a cleared section as null, never as an empty string", () => {
    expect(stopPatchBody({ section: "" })).toEqual({ section_id: null });
    expect(stopPatchBody({ section: "sec1" })).toEqual({ section_id: "sec1" });
    expect(stopPatchBody({ photo: "", description: "d", name: "n" })).toEqual({
      photo_path: "",
      description: "d",
      name: "n",
    });
    expect(stopPatchBody({})).toEqual({});
  });
});

describe("tour sections", () => {
  it("has a null cover photo when empty (unlike other photo fields)", () => {
    expect(toSection({ id: 1, label: "L", cover_photo_path: "", created_at: "c", updated_at: "u" })).toEqual({
      id: 1,
      label: "L",
      coverPhoto: null,
      createdAt: "c",
      updatedAt: "u",
    });
  });
  it("bodies", () => {
    expect(sectionCreateBody({ label: "L", coverPhoto: "" }).cover_photo_path).toBeUndefined();
    expect(sectionPatchBody({ coverPhoto: "p" })).toEqual({ cover_photo_path: "p" });
    expect(sectionPatchBody({})).toEqual({});
  });
});

describe("admins", () => {
  it("aliases id as uid", () => {
    expect(toAdmin({ id: 9, email: "e", name: "n", status: "pending", created_at: "c", updated_at: "u" })).toEqual({
      uid: 9,
      email: "e",
      name: "n",
      status: "pending",
      createdAt: "c",
      updatedAt: "u",
    });
  });
});

describe("room placard dialogs", () => {
  it("maps a row, with empty strings for missing text", () => {
    expect(
      toDialog({ id: 1, room_name: "203", search_terms: [{ term: "203" }, { term: "two" }], photo_360_path: "r.jpg" })
    ).toMatchObject({
      id: 1,
      roomName: "203",
      roomDescription: "",
      photo: "",
      photo360: "r.jpg",
      ocrSearchTerms: ["203", "two"],
    });
  });

  it("maps thumbnail focus, centered when the row has none", () => {
    expect(toDialog({ id: 1, room_name: "A" })).toMatchObject({ photoFocus: { x: 50, y: 50 }, extraPhotos: [] });
    expect(
      toDialog({ id: 1, room_name: "A", thumb_x: 10, thumb_y: 90, extra_photos: [{ path: "b.webp", thumb_x: 30, thumb_y: 40 }] })
    ).toMatchObject({ photoFocus: { x: 10, y: 90 }, extraPhotos: [{ path: "b.webp", x: 30, y: 40 }] });
  });

  it("patch sends thumbnail focus under the wire names", () => {
    expect(dialogPatchBody({ photoFocus: { x: 1, y: 2 }, extraPhotos: [{ path: "b.webp", x: 3, y: 4 }] })).toEqual({
      thumb_x: 1,
      thumb_y: 2,
      extra_photos: [{ path: "b.webp", thumb_x: 3, thumb_y: 4 }],
    });
  });

  it("normalizes names for lookup", () => {
    expect(normalizeRoomName("  rm 203 ")).toBe("RM 203");
    expect(normalizeRoomName(null)).toBe("");
  });

  it("patch maps app names to wire names", () => {
    expect(dialogPatchBody({ roomName: "N", roomDescription: "D", photo360: "p", ocrSearchTerms: ["x"] })).toEqual({
      room_name: "N",
      description: "D",
      photo_360_path: "p",
      search_terms: ["x"],
    });
  });

  it("a new record is seeded with a search term derived from the room name, then the patch applied", () => {
    expect(dialogCreateBody(" Rm 2-03 ", { department: "Math" })).toEqual({
      room_name: "Rm 2-03",
      description: "",
      search_terms: ["rm203"],
      department: "Math",
    });
  });

  it("a rename target wins over the lookup name, and patched terms win over the derived one", () => {
    expect(dialogCreateBody("old", { roomName: "New", ocrSearchTerms: ["z"] })).toMatchObject({
      room_name: "New",
      search_terms: ["z"],
    });
  });

  it("derives no search term from a name with no letters or digits", () => {
    expect(dialogCreateBody("---", {}).search_terms).toEqual([]);
  });
});
