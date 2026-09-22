import { describe, it, expect } from "vitest";
import { activeHint, activeHints, markSeen } from "./onboardingHints";

describe("activeHints", () => {
  it("is every id in order not yet seen", () => {
    expect(activeHints(["move", "menu", "directions"], [])).toEqual(["move", "menu", "directions"]);
    expect(activeHints(["move", "menu", "directions"], ["menu"])).toEqual(["move", "directions"]);
  });

  it("is empty once every id has been seen", () => {
    expect(activeHints(["move", "menu"], ["move", "menu"])).toEqual([]);
  });

  it("is empty for an empty order", () => {
    expect(activeHints([], [])).toEqual([]);
  });
});

describe("activeHint", () => {
  it("is the first id in order that hasn't been seen", () => {
    expect(activeHint(["move", "menu", "directions"], [])).toBe("move");
    expect(activeHint(["move", "menu", "directions"], ["move"])).toBe("menu");
  });

  it("skips a seen id even if it's out of order in the seen list", () => {
    expect(activeHint(["move", "menu", "directions"], ["menu", "move"])).toBe("directions");
  });

  it("is null once every id in order has been seen", () => {
    expect(activeHint(["move", "menu"], ["move", "menu"])).toBeNull();
  });

  it("is null for an empty order", () => {
    expect(activeHint([], [])).toBeNull();
  });

  it("ignores a seen id that isn't part of this order", () => {
    expect(activeHint(["move", "dock"], ["menu", "directions"])).toBe("move");
  });
});

describe("markSeen", () => {
  it("appends an id not already present", () => {
    expect(markSeen(["move"], "menu")).toEqual(["move", "menu"]);
  });

  it("returns the same array reference when the id is already seen", () => {
    const seen = ["move", "menu"];
    expect(markSeen(seen, "move")).toBe(seen);
  });

  it("starts from empty", () => {
    expect(markSeen([], "move")).toEqual(["move"]);
  });
});
