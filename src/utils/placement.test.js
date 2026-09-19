import { describe, it, expect } from "vitest";
import {
  newMarkerId,
  initialSession,
  isPlacing,
  selectFresh,
  walk,
  back,
  startPlacingLink,
  startPlacingMarker,
  startRepositionMarker,
  cancelLinkPlacement,
  cancelMarkerPlacement,
  place,
  withLink,
  withoutLink,
  withoutMarker,
  candidateLinks,
} from "./placement";

const angle = { yaw: 45, pitch: -3 };

describe("newMarkerId", () => {
  it("is prefixed and different each time", () => {
    const ids = new Set(Array.from({ length: 50 }, newMarkerId));
    expect([...ids][0]).toMatch(/^m_[0-9a-z]+$/);
    expect(ids.size).toBeGreaterThan(1);
  });
});

describe("moving around", () => {
  it("starts idle", () => {
    expect(initialSession()).toEqual({ history: [], placingFor: null, placingMarker: null, entryYaw: 0 });
    expect(isPlacing(initialSession())).toBe(false);
  });

  it("selecting from the list is a fresh start", () => {
    expect(selectFresh()).toEqual(initialSession());
  });

  it("walking records where you were, faces the way you went, and drops pending placement", () => {
    const busy = { ...startPlacingLink(initialSession(), "x"), placingMarker: { mode: "reposition", id: 1 } };
    expect(walk(busy, "a", { yaw: 90 })).toEqual({ history: ["a"], placingFor: null, placingMarker: null, entryYaw: 90 });
  });

  it("walking from nowhere records nothing, and faces forward without an angle", () => {
    expect(walk(initialSession(), null, undefined)).toMatchObject({ history: [], entryYaw: 0 });
  });

  it("back returns the previous id and clears placement", () => {
    const s = { ...startPlacingLink(initialSession(), "x"), history: ["a", "b"], entryYaw: 30 };
    expect(back(s)).toEqual({
      session: { history: ["a"], placingFor: null, placingMarker: null, entryYaw: 0 },
      id: "b",
    });
  });

  it("back with no history is nothing", () => {
    expect(back(initialSession())).toBeNull();
  });
});

describe("placing", () => {
  it("tracks what is being placed", () => {
    expect(isPlacing(startPlacingLink(initialSession(), "n"))).toBe(true);
    expect(isPlacing(startPlacingMarker(initialSession(), { id: "m" }))).toBe(true);
    expect(isPlacing(cancelLinkPlacement(startPlacingLink(initialSession(), "n")))).toBe(false);
    expect(isPlacing(cancelMarkerPlacement(startRepositionMarker(initialSession(), 1)))).toBe(false);
  });

  it("placing a link sets its angle and finishes", () => {
    const s = startPlacingLink(initialSession(), "n2");
    expect(place(s, { markers: [] }, angle)).toEqual({
      session: { ...s, placingFor: null },
      action: { type: "hotspot", neighborId: "n2", angle },
    });
  });

  it("placing a new marker appends it at the clicked angle, keeping whatever the domain put on it", () => {
    const existing = { id: 1, label: "old", yaw: 0, pitch: 0 };
    const s = startPlacingMarker(initialSession(), { id: "m_new", type: "equipment", label: "X-ray", photos: ["p.jpg"] });
    const { session, action } = place(s, { markers: [existing] }, angle);
    expect(action).toEqual({
      type: "markers",
      markers: [existing, { id: "m_new", type: "equipment", label: "X-ray", photos: ["p.jpg"], ...angle }],
    });
    expect(session.placingMarker).toBeNull();
  });

  it("placing a new marker on a point with no markers yet", () => {
    const s = startPlacingMarker(initialSession(), { id: "m", label: "L" });
    expect(place(s, {}, angle).action.markers).toEqual([{ id: "m", label: "L", ...angle }]);
  });

  it("repositioning moves only that marker's angle", () => {
    const markers = [
      { id: 1, label: "a", yaw: 0, pitch: 0 },
      { id: 2, label: "b", yaw: 9, pitch: 9 },
    ];
    const { action } = place(startRepositionMarker(initialSession(), 2), { markers }, angle);
    expect(action.markers).toEqual([markers[0], { id: 2, label: "b", ...angle }]);
  });

  it("does nothing when nothing is being placed", () => {
    expect(place(initialSession(), { markers: [] }, angle)).toBeNull();
  });
});

describe("links and markers", () => {
  const current = { id: "a", neighbors: ["b"], markers: [{ id: 1 }, { id: 2 }] };

  it("adds and removes a link", () => {
    expect(withLink(current, "c")).toEqual(["b", "c"]);
    expect(withLink({ id: "a" }, "c")).toEqual(["c"]);
    expect(withoutLink(current, "b")).toEqual([]);
    expect(withoutLink({ id: "a" }, "b")).toEqual([]);
  });

  it("removes a marker", () => {
    expect(withoutMarker(current, 1)).toEqual([{ id: 2 }]);
    expect(withoutMarker({ id: "a" }, 1)).toEqual([]);
  });
});

describe("candidateLinks", () => {
  const items = [
    { id: "a", name: "Hall" },
    { id: "b", name: "Lobby" },
    { id: "hall_2", name: "Second Hall" },
    { id: "c", name: "Lab" },
  ];
  const current = { id: "a", neighbors: ["b"] };

  it("matches id or name, ignoring case, and leaves out itself and existing neighbors", () => {
    expect(candidateLinks(items, current, "HALL").map((i) => i.id)).toEqual(["hall_2"]);
    expect(candidateLinks(items, current, "lab").map((i) => i.id)).toEqual(["c"]);
  });

  it("is empty for a blank query or no current point", () => {
    expect(candidateLinks(items, current, "  ")).toEqual([]);
    expect(candidateLinks(items, null, "hall")).toEqual([]);
  });

  it("returns at most 8", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `n${i}`, name: `Node ${i}` }));
    expect(candidateLinks(many, { id: "x" }, "node")).toHaveLength(8);
  });
});
