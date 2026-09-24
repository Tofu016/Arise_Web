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

  it("reports floors and leadsToFloors the target lacks", () => {
    const nodes = [node("gd1_f-1_stairs01", "gd1", -1, { type: "transition", leadsToFloors: [6] })];
    const { problems } = planBuildingMove(nodes, "gd1", "gd12", [1, 2, 3]);
    expect(problems).toHaveLength(2);
  });

  it("reports every declared floor the target lacks, not just one", () => {
    const nodes = [node("gd1_f-1_stairs01", "gd1", -1, { type: "transition", leadsToFloors: [6, 7] })];
    const { problems } = planBuildingMove(nodes, "gd1", "gd12", [1, 2, 3]);
    expect(problems.find((p) => p.includes("leads to"))).toContain("6, 7");
  });

  it("ignores a stray leadsToFloors on non-transition nodes", () => {
    const nodes = [node("gd1_f1_hallway04", "gd1", 1, { type: "hallway", leadsToFloors: [0] })];
    expect(planBuildingMove(nodes, "gd1", "gd12", [1]).problems).toEqual([]);
  });

  it("refuses moving a building onto itself", () => {
    expect(planBuildingMove([], "gd1", "gd1", [1]).problems).toHaveLength(1);
  });
});
