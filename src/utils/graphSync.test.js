import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./apiClient", () => ({ apiPost: vi.fn(), apiPatch: vi.fn(), apiDelete: vi.fn() }));

import { apiPost, apiPatch, apiDelete } from "./apiClient";
import { NODE_GRAPH, STOP_GRAPH, planNeighbors, planHotspot, planMarkers, runCalls } from "./graphSync";

beforeEach(() => vi.clearAllMocks());

describe("planNeighbors", () => {
  it("adds new links with placeholder angles, then removes dropped ones", () => {
    expect(planNeighbors(NODE_GRAPH, "a", ["b", "c"], ["c", "d"])).toEqual([
      {
        method: "POST",
        path: "Nodes_API/addNeighbor",
        body: { node_id: "a", neighbor_id: "d", yaw: 0, pitch: 0, reverse_yaw: 0, reverse_pitch: 0 },
      },
      { method: "POST", path: "Nodes_API/removeNeighbor", body: { node_id: "a", neighbor_id: "b" } },
    ]);
  });

  it("addresses tour stops by stop_id on their own API", () => {
    const [call] = planNeighbors(STOP_GRAPH, "s1", [], ["s2"]);
    expect(call.path).toBe("TourStops_API/addNeighbor");
    expect(call.body).toMatchObject({ stop_id: "s1", neighbor_id: "s2" });
    expect(call.body.node_id).toBeUndefined();
  });

  it("plans nothing when nothing changed", () => {
    expect(planNeighbors(NODE_GRAPH, "a", ["b"], ["b"])).toEqual([]);
  });
});

describe("planHotspot", () => {
  it("updates a link's angle", () => {
    expect(planHotspot(STOP_GRAPH, "s1", "s2", { yaw: 10, pitch: -4 })).toEqual([
      { method: "PATCH", path: "TourStops_API/updateNeighborAngle", body: { stop_id: "s1", neighbor_id: "s2", yaw: 10, pitch: -4 } },
    ]);
  });
});

describe("planMarkers", () => {
  const current = [
    { id: 1, type: "exit", label: "A", yaw: 0, pitch: 0 },
    { id: 2, type: "info", label: "B", yaw: 5, pitch: 5 },
    { id: 3, type: "info", label: "C", yaw: 9, pitch: 9 },
  ];

  it("adds, repositions and removes, in that order", () => {
    const next = [
      { id: 1, type: "exit", label: "A", yaw: 0, pitch: 0 }, // untouched
      { id: 2, type: "info", label: "B", yaw: 50, pitch: 5 }, // moved
      { id: "new", type: "info", label: "D", yaw: 1, pitch: 2 }, // added; id 3 removed
    ];
    expect(planMarkers(NODE_GRAPH, "a", current, next)).toEqual([
      { method: "POST", path: "Nodes_API/addMarker", body: { node_id: "a", type: "info", label: "D", yaw: 1, pitch: 2 } },
      { method: "PATCH", path: "Nodes_API/updateMarker/2", body: { yaw: 50, pitch: 5 } },
      { method: "DELETE", path: "Nodes_API/deleteMarker/3", body: undefined },
    ]);
  });

  it("stop markers are added with their photos and no type", () => {
    const [call] = planMarkers(STOP_GRAPH, "s1", [], [{ id: "x", type: "info", label: "L", yaw: 1, pitch: 2, photos: ["p.jpg"] }]);
    expect(call.body).toEqual({ stop_id: "s1", label: "L", yaw: 1, pitch: 2, photos: ["p.jpg"] });
  });

  it("a stop marker with no photos is added with an empty list", () => {
    const [call] = planMarkers(STOP_GRAPH, "s1", [], [{ id: "x", label: "L", yaw: 1, pitch: 2 }]);
    expect(call.body.photos).toEqual([]);
  });

  it("does not send a label-only edit (known limit: only position is compared)", () => {
    const next = current.map((m) => (m.id === 1 ? { ...m, label: "renamed" } : m));
    expect(planMarkers(NODE_GRAPH, "a", current, next)).toEqual([]);
  });
});

describe("runCalls", () => {
  it("performs each call in order through the matching client function", async () => {
    const order = [];
    apiPost.mockImplementation(async () => order.push("post"));
    apiPatch.mockImplementation(async () => order.push("patch"));
    apiDelete.mockImplementation(async () => order.push("delete"));

    await runCalls([
      { method: "POST", path: "p1", body: { a: 1 } },
      { method: "PATCH", path: "p2", body: { b: 2 } },
      { method: "DELETE", path: "p3" },
    ]);

    expect(order).toEqual(["post", "patch", "delete"]);
    expect(apiPost).toHaveBeenCalledWith("p1", { a: 1 });
    expect(apiPatch).toHaveBeenCalledWith("p2", { b: 2 });
    expect(apiDelete).toHaveBeenCalledWith("p3");
  });

  it("stops at the first failure", async () => {
    apiPost.mockRejectedValueOnce(new Error("boom"));
    await expect(
      runCalls([
        { method: "POST", path: "p1", body: {} },
        { method: "DELETE", path: "p2" },
      ])
    ).rejects.toThrow("boom");
    expect(apiDelete).not.toHaveBeenCalled();
  });
});
