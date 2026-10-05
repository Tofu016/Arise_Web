import { describe, expect, it } from "vitest";
import { MARKER_TYPES, NODE_TYPES, suggestNodeId } from "./constants";

describe("type ids", () => {
  it("are the snake_case form of their label", () => {
    const slug = (label) => label.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    for (const t of NODE_TYPES) expect(t.id).toBe(slug(t.label));
    for (const t of MARKER_TYPES) expect(t.id).toBe(slug(t.label));
  });

  it("have no Fire Exit node type: a fire exit is a marker on an ordinary node", () => {
    expect(NODE_TYPES.map((t) => t.id)).not.toContain("fire_exit");
    expect(MARKER_TYPES.map((t) => t.id)).toContain("emergency_exit");
  });
});

describe("suggestNodeId", () => {
  it("builds the id from the type id as is", () => {
    expect(suggestNodeId("gd1", 2, "stairs", [])).toBe("gd1_f2_stairs01");
    expect(suggestNodeId("gd1", 2, "open_area", [])).toBe("gd1_f2_open_area01");
    expect(suggestNodeId("gd2", -1, "parking", [])).toBe("gd2_f-1_parking01");
  });

  it("picks the next free number for that building, floor and type", () => {
    const nodes = [{ id: "gd1_f2_stairs01" }, { id: "gd1_f2_stairs03" }, { id: "gd1_f2_hallway01" }];
    expect(suggestNodeId("gd1", 2, "stairs", nodes)).toBe("gd1_f2_stairs02");
  });
});
