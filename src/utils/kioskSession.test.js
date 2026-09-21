import { describe, it, expect } from "vitest";
import { initialKioskSession, kioskSessionReducer, kioskStage } from "./kioskSession";

const run = (...types) => types.reduce((s, type) => kioskSessionReducer(s, { type }), initialKioskSession);

describe("kioskStage", () => {
  it("goes start → building → exploring on the compact layout", () => {
    expect(kioskStage(run(), true)).toBe("start");
    expect(kioskStage(run("start"), true)).toBe("building");
    expect(kioskStage(run("start", "chooseBuilding"), true)).toBe("exploring");
  });

  it("never leaves the start screen before it is tapped", () => {
    expect(kioskStage(run("chooseBuilding"), true)).toBe("start");
  });

  it("is always exploring on desktop", () => {
    expect(kioskStage(run(), false)).toBe("exploring");
  });

  it("follows the layout if it changes mid-session, keeping progress", () => {
    const s = run("start");
    expect(kioskStage(s, true)).toBe("building");
    expect(kioskStage(s, false)).toBe("exploring");
    expect(kioskStage(s, true)).toBe("building");
  });
});
