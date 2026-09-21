import { describe, it, expect } from "vitest";
import { planPrefetch, nextFirstLoadDone, PREFETCH_LIMIT } from "./photoPipeline";

const hs = (...ids) => ids.map((id) => ({ id, photo: `${id}.jpg` }));

describe("planPrefetch", () => {
  it("keeps hotspot order when there is no priority", () => {
    expect(planPrefetch(hs("a", "b", "c"), { currentId: "x" })).toEqual(["a.jpg", "b.jpg", "c.jpg"]);
  });

  it("puts the route's next stop first, leaving the rest in order", () => {
    expect(planPrefetch(hs("a", "b", "c"), { currentId: "x", priorityId: "c" })).toEqual(["c.jpg", "a.jpg", "b.jpg"]);
  });

  it("skips hotspots with no photo and the current node", () => {
    const neighbors = [...hs("a"), { id: "b", photo: "" }, { id: "x", photo: "x.jpg" }];
    expect(planPrefetch(neighbors, { currentId: "x" })).toEqual(["a.jpg"]);
  });

  it("caps the list, but a priority stop past the cap still makes it", () => {
    const many = hs(..."abcdefghij".split(""));
    const plan = planPrefetch(many, { currentId: "x", priorityId: "j" });
    expect(plan).toHaveLength(PREFETCH_LIMIT);
    expect(plan[0]).toBe("j.jpg");
  });

  it("does not mutate the input", () => {
    const input = hs("a", "b");
    planPrefetch(input, { currentId: "x", priorityId: "b" });
    expect(input.map((h) => h.id)).toEqual(["a", "b"]);
  });
});

describe("nextFirstLoadDone", () => {
  it("waits for both the nodes and a paintable photo", () => {
    expect(nextFirstLoadDone(false, { nodesLoaded: false, photoReady: true })).toBe(false);
    expect(nextFirstLoadDone(false, { nodesLoaded: true, photoReady: false })).toBe(false);
    expect(nextFirstLoadDone(false, { nodesLoaded: true, photoReady: true })).toBe(true);
  });

  it("never un-latches", () => {
    expect(nextFirstLoadDone(true, { nodesLoaded: true, photoReady: false })).toBe(true);
  });
});
