import { describe, it, expect } from "vitest";
import { initialKioskSession, kioskSessionReducer, kioskStage } from "./kioskSession";

const run = (...actions) =>
  actions.reduce(
    (s, a) => kioskSessionReducer(s, typeof a === "string" ? { type: a } : a),
    initialKioskSession
  );

describe("kioskStage", () => {
  it("goes start → campus → building → floor → exploring for Main Campus", () => {
    expect(kioskStage(run(), true)).toBe("start");
    expect(kioskStage(run("start"), true)).toBe("campus");
    expect(kioskStage(run("start", { type: "chooseCampus", campus: "main" }), true)).toBe("building");
    expect(
      kioskStage(
        run("start", { type: "chooseCampus", campus: "main" }, { type: "chooseBuilding", building: "gd1" }),
        true
      )
    ).toBe("floor");
    expect(
      kioskStage(
        run(
          "start",
          { type: "chooseCampus", campus: "main" },
          { type: "chooseBuilding", building: "gd1" },
          "chooseFloor"
        ),
        true
      )
    ).toBe("exploring");
  });

  it("skips the building screen for a single-building campus", () => {
    const s = run("start", { type: "chooseCampus", campus: "digital" });
    expect(kioskStage(s, true)).toBe("floor");
  });

  it("never leaves the start screen before it is tapped", () => {
    expect(kioskStage(run({ type: "chooseCampus", campus: "main" }), true)).toBe("start");
  });

  it("never reaches the building screen before a campus is chosen", () => {
    expect(kioskStage(run("start", { type: "chooseBuilding", building: "gd1" }), true)).toBe("campus");
  });

  it("never reaches the floor screen before a building is chosen on Main Campus", () => {
    expect(kioskStage(run("start", { type: "chooseCampus", campus: "main" }, "chooseFloor"), true)).toBe("building");
  });

  it("re-requires a floor pick after a second building is chosen", () => {
    const s = run(
      "start",
      { type: "chooseCampus", campus: "main" },
      { type: "chooseBuilding", building: "gd1" },
      "chooseFloor",
      { type: "chooseBuilding", building: "gd2" }
    );
    expect(kioskStage(s, true)).toBe("floor");
  });

  it("returns to the building screen on backToBuilding", () => {
    const s = run(
      "start",
      { type: "chooseCampus", campus: "main" },
      { type: "chooseBuilding", building: "gd1" },
      "backToBuilding"
    );
    expect(kioskStage(s, true)).toBe("building");
  });

  it("returns to the campus screen on backToCampus", () => {
    const s = run("start", { type: "chooseCampus", campus: "main" }, { type: "chooseBuilding", building: "gd1" }, "backToCampus");
    expect(kioskStage(s, true)).toBe("campus");
  });

  it("is always exploring on desktop", () => {
    expect(kioskStage(run(), false)).toBe("exploring");
  });

  it("follows the layout if it changes mid-session, keeping progress", () => {
    const s = run("start");
    expect(kioskStage(s, true)).toBe("campus");
    expect(kioskStage(s, false)).toBe("exploring");
    expect(kioskStage(s, true)).toBe("campus");
  });
});

describe("kioskSessionReducer", () => {
  it("records which campus was chosen, and sets the building for a single-building campus", () => {
    expect(run({ type: "chooseCampus", campus: "main" }).building).toBeNull();
    expect(run({ type: "chooseCampus", campus: "digital" }).building).toBe("digital");
  });

  it("records which building was chosen", () => {
    expect(run({ type: "chooseBuilding", building: "gd2" }).building).toBe("gd2");
  });

  it("clears the chosen building on backToBuilding", () => {
    expect(run({ type: "chooseBuilding", building: "gd2" }, "backToBuilding").building).toBeNull();
  });

  it("clears the campus and building on backToCampus", () => {
    const s = run({ type: "chooseCampus", campus: "main" }, { type: "chooseBuilding", building: "gd2" }, "backToCampus");
    expect(s.campus).toBeNull();
    expect(s.building).toBeNull();
  });
});
