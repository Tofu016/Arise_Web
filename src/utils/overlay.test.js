import { describe, it, expect } from "vitest";
import { initialOverlay, overlayReducer, blocksIdle, coverage } from "./overlay";

const run = (...actions) => actions.reduce(overlayReducer, initialOverlay);
const room = { roomName: "203" };

describe("panel slot", () => {
  it("holds one panel at a time", () => {
    expect(run({ type: "showPanel", mode: "search" }, { type: "showPanel", mode: "account" }).panel).toBe("account");
  });

  it("toggles the menu", () => {
    const open = run({ type: "toggleMenu" });
    expect(open.panel).toBe("menu");
    expect(overlayReducer(open, { type: "toggleMenu" }).panel).toBeNull();
    expect(overlayReducer(run({ type: "showPanel", mode: "search" }), { type: "toggleMenu" }).panel).toBe("menu");
  });

  it("blurring only closes search", () => {
    expect(run({ type: "showPanel", mode: "search" }, { type: "blurSearch" }).panel).toBeNull();
    expect(run({ type: "showPanel", mode: "directions" }, { type: "blurSearch" }).panel).toBe("directions");
  });
});

describe("dock", () => {
  it("dismiss collapses the dock and its panel", () => {
    const s = run({ type: "openDock" }, { type: "showPanel", mode: "search" }, { type: "dismiss" });
    expect(s).toMatchObject({ dock: false, panel: null });
  });

  it("a radial item collapses the dock and opens its target", () => {
    expect(run({ type: "openDock" }, { type: "openFromDock", target: "search" })).toMatchObject({ dock: false, panel: "search" });
    expect(run({ type: "openDock" }, { type: "openFromDock", target: "feedback" })).toMatchObject({ dock: false, feedback: true });
    expect(
      run({ type: "setFloorPick", building: "gd1" }, { type: "openFromDock", target: "building" })
    ).toMatchObject({ buildingMenu: true, floorPick: null });
  });
});

describe("directions", () => {
  it("replaces the panel, closes the dock and starts on the big dialog", () => {
    const s = run({ type: "openDock" }, { type: "setWalkDialog", open: false }, { type: "openDirections" });
    expect(s).toMatchObject({ panel: "directions", dock: false, walkDialog: true });
  });

  it("collapses to the walk bar once walking starts, and back on close", () => {
    const walking = run({ type: "openDirections" }, { type: "walkStarted" });
    expect(walking).toMatchObject({ panel: "directions", walkDialog: false });
    expect(overlayReducer(walking, { type: "closeDirections" })).toMatchObject({ panel: null, walkDialog: true });
  });
});

describe("moves", () => {
  it("a walk or back leaves the panel alone but closes the dock", () => {
    const base = run({ type: "openDock" }, { type: "showPanel", mode: "directions" });
    for (const type of ["walk", "back"]) {
      expect(overlayReducer(base, { type: "moved", move: { type } })).toMatchObject({ dock: false, panel: "directions" });
    }
  });

  it("a jump from a room opens its card; any other jump closes the panel", () => {
    expect(run({ type: "moved", move: { type: "jump", room } })).toMatchObject({ panel: "room", roomCard: room });
    expect(run({ type: "showPanel", mode: "search" }, { type: "moved", move: { type: "jump" } }).panel).toBeNull();
  });

  it("a jump held behind a flyover closes the panel; a walk keeps it", () => {
    const base = run({ type: "openDock" }, { type: "showPanel", mode: "search" });
    expect(overlayReducer(base, { type: "heldForFlyover", closePanel: true })).toMatchObject({ dock: false, panel: null });
    expect(overlayReducer(base, { type: "heldForFlyover", closePanel: false })).toMatchObject({ dock: false, panel: "search" });
  });

  it("closing the room card forgets it and closes the panel", () => {
    const s = run({ type: "moved", move: { type: "jump", room } }, { type: "closeRoomCard" });
    expect(s).toMatchObject({ roomCard: null, panel: null });
  });

  it("keeps the room card while its 360° view is open over a closed panel", () => {
    const s = run({ type: "moved", move: { type: "jump", room } }, { type: "openRoom360" }, { type: "closePanel" });
    expect(s).toMatchObject({ roomCard: room, room360: true });
  });
});

describe("blocksIdle", () => {
  const ctx = { flyover: null, awaitingStart: false };
  it("is false with nothing up", () => expect(blocksIdle(initialOverlay, ctx)).toBe(false));
  it("is true for a panel, the dock, feedback, a 360° view, a flyover or the kiosk start screens", () => {
    expect(blocksIdle(run({ type: "showPanel", mode: "search" }), ctx)).toBe(true);
    expect(blocksIdle(run({ type: "openDock" }), ctx)).toBe(true);
    expect(blocksIdle(run({ type: "openFeedback" }), ctx)).toBe(true);
    expect(blocksIdle(run({ type: "openRoom360" }), ctx)).toBe(true);
    expect(blocksIdle(initialOverlay, { ...ctx, flyover: {} })).toBe(true);
    expect(blocksIdle(initialOverlay, { ...ctx, awaitingStart: true })).toBe(true);
  });
  it("does not count the building dialog", () => {
    expect(blocksIdle({ ...initialOverlay, buildingMenu: true }, ctx)).toBe(false);
  });
});

describe("coverage", () => {
  const base = { compact: true, directions: { path: [] }, arrived: false, walkStarted: true, flyover: null };

  it("covers the panorama for a panel, but not for the walk bar", () => {
    const dialog = run({ type: "openDirections" });
    expect(coverage(dialog, base)).toMatchObject({ walkBarShown: false, coversPanorama: true, kioskDialogOpen: true });
    const bar = run({ type: "openDirections" }, { type: "walkStarted" });
    expect(coverage(bar, base)).toMatchObject({ walkBarShown: true, coversPanorama: false, kioskDialogOpen: false });
  });

  it("only shows the walk bar on the kiosk, and not once arrived", () => {
    const bar = run({ type: "openDirections" }, { type: "walkStarted" });
    expect(coverage(bar, { ...base, compact: false }).walkBarShown).toBe(false);
    expect(coverage(bar, { ...base, arrived: true }).walkBarShown).toBe(false);
  });

  it("kiosk dialogs are search, directions and feedback, and only on the kiosk", () => {
    expect(coverage(run({ type: "showPanel", mode: "search" }), base).kioskDialogOpen).toBe(true);
    expect(coverage(run({ type: "showPanel", mode: "search" }), { ...base, compact: false }).kioskDialogOpen).toBe(false);
    expect(coverage(run({ type: "openFeedback" }), base).kioskDialogOpen).toBe(true);
    expect(coverage(run({ type: "showPanel", mode: "account" }), base).kioskDialogOpen).toBe(false);
  });

  it("the building dialog, dock, 360° view and flyover cover the panorama", () => {
    expect(coverage({ ...initialOverlay, buildingMenu: true }, base).coversPanorama).toBe(true);
    expect(coverage(run({ type: "openDock" }), base).coversPanorama).toBe(true);
    expect(coverage(run({ type: "openRoom360" }), base).coversPanorama).toBe(true);
    expect(coverage(initialOverlay, { ...base, flyover: {} }).coversPanorama).toBe(true);
    expect(coverage(initialOverlay, base).coversPanorama).toBe(false);
  });
});
