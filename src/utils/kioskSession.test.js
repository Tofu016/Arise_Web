import { describe, it, expect } from "vitest";
import { initialKioskSession, kioskSessionReducer, kioskStage } from "./kioskSession";

const run = (...actions) =>
  actions.reduce(
    (s, a) => kioskSessionReducer(s, typeof a === "string" ? { type: a } : a),
    initialKioskSession
  );

describe("kioskStage", () => {
  it("goes start → building → floor → exploring on the compact layout", () => {
    expect(kioskStage(run(), true)).toBe("start");
    expect(kioskStage(run("start"), true)).toBe("building");
    expect(kioskStage(run("start", { type: "chooseBuilding", building: "gd1" }), true)).toBe("floor");
    expect(
      kioskStage(run("start", { type: "chooseBuilding", building: "gd1" }, "chooseFloor"), true)
    ).toBe("exploring");
  });

  it("never leaves the start screen before it is tapped", () => {
    expect(kioskStage(run({ type: "chooseBuilding", building: "gd1" }), true)).toBe("start");
  });

  it("never reaches the floor screen before a building is chosen", () => {
    expect(kioskStage(run("start", "chooseFloor"), true)).toBe("building");
  });

  it("re-requires a floor pick after a second building is chosen", () => {
    const s = run(
      "start",
      { type: "chooseBuilding", building: "gd1" },
      "chooseFloor",
      { type: "chooseBuilding", building: "gd2" }
    );
    expect(kioskStage(s, true)).toBe("floor");
  });

  it("returns to the building screen on backToBuilding", () => {
    const s = run("start", { type: "chooseBuilding", building: "gd1" }, "backToBuilding");
    expect(kioskStage(s, true)).toBe("building");
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

describe("kioskSessionReducer", () => {
  it("records which building was chosen", () => {
    expect(run({ type: "chooseBuilding", building: "gd2" }).building).toBe("gd2");
  });

  it("clears the chosen building on backToBuilding", () => {
    expect(run({ type: "chooseBuilding", building: "gd2" }, "backToBuilding").building).toBeNull();
  });
});
