import { describe, it, expect } from "vitest";
import { planBuildingMove } from "./buildingMove";

const node = (id, building, floor, extra = {}) => ({ id, building, floor, ...extra });

describe("planBuildingMove", () => {
  it("re-prefixes ids of the source building only", () => {
    const nodes = [node("gd1_f1_hall01", "gd1", 1), node("gd2_f1_hall01", "gd2", 1)];
    const { moves, problems } = planBuildingMove(nodes, "gd1", "gd12", [1, 2]);
    expect(problems).toEqual([]);
    expect(moves).toEqual([{ id: "gd1_f1_hall01", newId: "gd12_f1_hall01" }]);
  });

  it("reports an id already used by a node that isn't moving", () => {
    const nodes = [node("gd1_f1_hall01", "gd1", 1), node("gd12_f1_hall01", "gd12", 1)];
    const { problems } = planBuildingMove(nodes, "gd1", "gd12", [1]);
    expect(problems).toHaveLength(1);
  });

  it("reports a floor the target building lacks", () => {
    const nodes = [node("gd1_f-1_stairs01", "gd1", -1, { type: "stairs" })];
    const { problems } = planBuildingMove(nodes, "gd1", "gd12", [1, 2, 3]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("floor -1");
  });

  it("keeps emergency exit landings valid: they move with their building, ids follow the rename", () => {
    const nodes = [
      node("gd1_f2_hall01", "gd1", 2, { markers: [{ id: 1, type: "emergency_exit", landings: ["gd1_f1_hall01"] }] }),
      node("gd1_f1_hall01", "gd1", 1),
    ];
    const { moves, problems } = planBuildingMove(nodes, "gd1", "gd12", [1, 2]);
    expect(problems).toEqual([]);
    expect(moves.map((m) => m.newId)).toEqual(["gd12_f2_hall01", "gd12_f1_hall01"]);
  });

  it("refuses moving a building onto itself", () => {
    expect(planBuildingMove([], "gd1", "gd1", [1]).problems).toHaveLength(1);
  });
});
