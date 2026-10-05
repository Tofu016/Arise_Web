import { describe, it, expect } from "vitest";
import {
  arrivalYawFromExit,
  emergencyExitMarkers,
  exitLandingEdges,
  fireExitCrossFloorLinks,
  fireStairsBetween,
  fireStairsAction,
  fireStairsAnnouncement,
  isFireExitNode,
  landingCandidates,
  landingProblems,
} from "./emergencyExits";

const exitMarker = (id, landings = [], yaw = 0) => ({ id, type: "emergency_exit", label: "Emergency Exit", yaw, pitch: 0, landings });
const node = (id, floor, extra = {}) => ({
  id, name: id, building: "gd1", floor, type: "hallway", neighbors: [], markers: [], ...extra,
});

describe("isFireExitNode", () => {
  it("is true only for a node carrying an emergency exit marker", () => {
    expect(isFireExitNode(node("a", 3, { markers: [exitMarker(1)] }))).toBe(true);
    expect(isFireExitNode(node("b", 3, { markers: [{ id: 2, type: "room", label: "R" }] }))).toBe(false);
    expect(isFireExitNode(node("c", 3))).toBe(false);
  });

  it("keeps the node's own type: a hallway holding a fire stairwell is still a hallway", () => {
    const n = node("a", 3, { markers: [exitMarker(1, ["b"])] });
    expect(n.type).toBe("hallway");
    expect(emergencyExitMarkers(n)).toHaveLength(1);
  });
});

describe("exitLandingEdges", () => {
  it("lists landings in marker order, directed from the marker's node only", () => {
    const edges = exitLandingEdges([
      node("a", 3, { markers: [exitMarker(1, ["c", "b"])] }),
      node("b", 2),
      node("c", 1),
    ]);
    expect(edges.get("a")).toEqual([{ toId: "c", markerId: 1 }, { toId: "b", markerId: 1 }]);
    expect(edges.has("b")).toBe(false);
    expect(edges.has("c")).toBe(false);
  });

  it("skips a missing node, itself, and a target two markers both list", () => {
    const edges = exitLandingEdges([
      node("a", 3, { markers: [exitMarker(1, ["ghost", "a", "b"]), exitMarker(2, ["b"])] }),
      node("b", 2),
    ]);
    expect(edges.get("a")).toEqual([{ toId: "b", markerId: 1 }]);
  });
});

describe("fireStairsBetween", () => {
  const nodes = [
    node("a", 3, { markers: [exitMarker(1, ["b"], 40)] }),
    node("b", 2, { markers: [exitMarker(2, [], 100)] }),
    node("c", 2),
  ];

  it("finds the marker that lists the target, plus the landing's own door", () => {
    const ride = fireStairsBetween(nodes, "a", "b");
    expect(ride.fromMarker.id).toBe(1);
    expect(ride.toMarker.id).toBe(2);
    expect(ride.toFloor).toBe(2);
  });

  it("is null for a node that is not a listed landing, in either direction", () => {
    expect(fireStairsBetween(nodes, "a", "c")).toBeNull();
    expect(fireStairsBetween(nodes, "b", "a")).toBeNull();
  });

  it("is null when the two are ordinary neighbors", () => {
    const linked = [
      node("a", 3, { neighbors: ["b"], markers: [exitMarker(1, ["b"])] }),
      node("b", 3, { neighbors: ["a"] }),
    ];
    expect(fireStairsBetween(linked, "a", "b")).toBeNull();
  });

  it("arrives facing away from the landing's own door", () => {
    expect(arrivalYawFromExit({ yaw: 100 })).toBe(280);
    expect(arrivalYawFromExit({ yaw: 300 })).toBe(120);
  });
});

describe("landingProblems", () => {
  it("reports a missing node, itself, another building and the same floor", () => {
    const nodes = [
      node("a", 3, { markers: [exitMarker(1, ["ghost", "a", "far", "same", "ok"])] }),
      node("far", 1, { building: "gd2" }),
      node("same", 3),
      node("ok", 1),
    ];
    expect(landingProblems(nodes).map((p) => [p.landingId, p.problem])).toEqual([
      ["ghost", "missing"], ["a", "self"], ["far", "building"], ["same", "floor"],
    ]);
  });

  it("is empty for clean data", () => {
    expect(landingProblems([node("a", 3, { markers: [exitMarker(1, ["b"])] }), node("b", 2)])).toEqual([]);
  });
});

describe("fireExitCrossFloorLinks", () => {
  it("flags an ordinary cross-floor link on a node whose fire stairs have landings", () => {
    const nodes = [
      node("a", 3, { neighbors: ["b", "c"], markers: [exitMarker(1, ["d"])] }),
      node("b", 2),
      node("c", 3),
      node("d", 1),
    ];
    expect(fireExitCrossFloorLinks(nodes)).toEqual([{ nodeId: "a", neighborId: "b" }]);
  });

  it("ignores a fire door with no landings, which may sit beside a Stairs link", () => {
    const nodes = [node("a", 1, { neighbors: ["b"], markers: [exitMarker(1)] }), node("b", 2)];
    expect(fireExitCrossFloorLinks(nodes)).toEqual([]);
  });
});

describe("landingCandidates", () => {
  const all = [
    node("here", 3),
    node("up", 4, { name: "Upper hall" }),
    node("g", 1, { name: "Ground hall" }),
    node("b", 2, { name: "Annex stairs", building: "gd2" }),
    node("g2", 1, { name: "Atrium" }),
    node("same", 3),
  ];

  it("offers other floors of the same building, lowest first, never itself or its own floor", () => {
    expect(landingCandidates(all, all[0]).map((n) => n.id)).toEqual(["g2", "g", "up"]);
  });

  it("filters by name or id", () => {
    expect(landingCandidates(all, all[0], "atri").map((n) => n.id)).toEqual(["g2"]);
    expect(landingCandidates(all, all[0], "UP").map((n) => n.id)).toEqual(["up"]);
  });
});

describe("fire stairs wording", () => {
  it("names the step and the spoken line the same way", () => {
    expect(fireStairsAction({ floor: 1, goesDown: true })).toBe("Take Emergency Exit stairs down to Floor 1");
    expect(fireStairsAnnouncement({ floor: 1, goesDown: true })).toBe("Emergency Exit stairs ahead. Take them down to Floor 1.");
    expect(fireStairsAnnouncement({ floor: -1, goesDown: false })).toMatch(/up to /);
  });
});
