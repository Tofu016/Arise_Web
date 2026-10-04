import { describe, expect, it } from "vitest";
import { MARKER_TYPES, NODE_TYPES, TRANSITION_TYPES, suggestNodeId } from "./constants";

describe("type ids", () => {
  it("are the snake_case form of their label", () => {
    const slug = (label) => label.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    for (const t of NODE_TYPES) expect(t.id).toBe(slug(t.label));
    for (const t of MARKER_TYPES) expect(t.id).toBe(slug(t.label));
  });

  it("only name node types that exist as transition types", () => {
    for (const id of TRANSITION_TYPES) expect(NODE_TYPES.map((t) => t.id)).toContain(id);
  });
});

describe("suggestNodeId", () => {
  it("builds the id from the type id as is", () => {
    expect(suggestNodeId("gd1", 2, "stairs", [])).toBe("gd1_f2_stairs01");
    expect(suggestNodeId("gd1", 2, "fire_exit", [])).toBe("gd1_f2_fire_exit01");
    expect(suggestNodeId("gd2", -1, "building_transition", [])).toBe("gd2_f-1_building_transition01");
  });

  it("picks the next free number for that building, floor and type", () => {
    const nodes = [{ id: "gd1_f2_stairs01" }, { id: "gd1_f2_stairs03" }, { id: "gd1_f2_hallway01" }];
    expect(suggestNodeId("gd1", 2, "stairs", nodes)).toBe("gd1_f2_stairs02");
  });
});
