import { describe, it, expect } from "vitest";
import {
  ocrStateOf,
  sameOcrState,
  addToOcr,
  removeFromOcr,
  addExtraTerm,
  removeExtraTerm,
  ocrStateProblem,
  withOcrState,
  hasStaleTerms,
  ocrCollisions,
  hasOcrPhoto,
} from "./ocrSettings";

const OFF = { ocrEnabled: false, placardName: "", extraTerms: [], photoPaths: [] };

describe("ocrStateOf", () => {
  it("reads a saved record", () => {
    const room = { roomName: "A", placard: { ocrEnabled: true, placardName: "Rm A", ocrExtraTerms: ["x"], ocrPhotos: ["room360/gd1/a.webp"] } };
    expect(ocrStateOf(room)).toEqual({ ocrEnabled: true, placardName: "Rm A", extraTerms: ["x"], photoPaths: ["room360/gd1/a.webp"] });
  });
  it("is off for a room with no record", () => {
    expect(ocrStateOf({ roomName: "A", placard: null })).toEqual(OFF);
  });
});

describe("sameOcrState", () => {
  it("compares every field, extra terms and AR 360 images in order", () => {
    const a = { ocrEnabled: true, placardName: "A", extraTerms: ["x", "y"], photoPaths: ["p1", "p2"] };
    expect(sameOcrState(a, { ...a, extraTerms: ["x", "y"] })).toBe(true);
    expect(sameOcrState(a, { ...a, extraTerms: ["y", "x"] })).toBe(false);
    expect(sameOcrState(a, { ...a, placardName: "B" })).toBe(false);
    expect(sameOcrState(a, { ...a, ocrEnabled: false })).toBe(false);
    expect(sameOcrState(a, { ...a, photoPaths: ["p1", "p2"] })).toBe(true);
    expect(sameOcrState(a, { ...a, photoPaths: ["p2", "p1"] })).toBe(false);
    expect(sameOcrState(a, { ...a, photoPaths: ["p1"] })).toBe(false);
  });
});

describe("addToOcr and removeFromOcr", () => {
  it("starts the Placard name from the room name", () => {
    expect(addToOcr(OFF, "Room 101")).toEqual({ ...OFF, ocrEnabled: true, placardName: "Room 101" });
  });
  it("keeps a Placard name set before", () => {
    expect(addToOcr({ ...OFF, placardName: "Rm 101" }, "Room 101").placardName).toBe("Rm 101");
  });
  it("keeps the name, extra terms and AR 360 image when taken off", () => {
    const on = { ocrEnabled: true, placardName: "Rm 101", extraTerms: ["x"], photoPaths: ["room360/gd1/a.webp"] };
    expect(removeFromOcr(on)).toEqual({ ...on, ocrEnabled: false });
  });
});

describe("addExtraTerm and removeExtraTerm", () => {
  const on = { ocrEnabled: true, placardName: "GD1-101", extraTerms: [] };
  it("stores the term in compact form", () => {
    const { state, refused } = addExtraTerm(on, " GD1 1O1 ");
    expect(refused).toBe(null);
    expect(state.extraTerms).toEqual(["gd11o1"]);
  });
  it("refuses an empty term", () => {
    expect(addExtraTerm(on, " -- ")).toEqual({ state: on, refused: "empty" });
  });
  it("refuses a term already there or already generated", () => {
    const withOne = addExtraTerm(on, "Rm 101").state;
    expect(addExtraTerm(withOne, "rm101").refused).toBe("duplicate");
    expect(addExtraTerm(on, "GD1 101").refused).toBe("duplicate");
  });
  it("removes a term", () => {
    expect(removeExtraTerm({ ...on, extraTerms: ["a", "b"] }, "a").extraTerms).toEqual(["b"]);
  });
});

describe("ocrStateProblem", () => {
  it("needs a usable Placard name only for an eligible room", () => {
    expect(ocrStateProblem({ ...OFF, ocrEnabled: true, placardName: " " })).toMatch(/Enter/);
    expect(ocrStateProblem({ ...OFF, ocrEnabled: true, placardName: "--" })).toMatch(/letter or number/);
    expect(ocrStateProblem({ ...OFF, ocrEnabled: true, placardName: "Lab" })).toBe(null);
    expect(ocrStateProblem(OFF)).toBe(null);
  });
});

describe("withOcrState", () => {
  it("gives the room the terms it would have once saved", () => {
    const room = { roomName: "A", placard: { id: 1, ocrSearchTerms: ["old"] } };
    const next = withOcrState(room, { ocrEnabled: true, placardName: "GD1-101", extraTerms: ["x"] });
    expect(next.placard).toMatchObject({ id: 1, ocrEnabled: true, placardName: "GD1-101", ocrSearchTerms: ["gd1-101", "gd1101", "x"] });
  });
});

describe("hasStaleTerms", () => {
  it("flags an eligible room whose stored generated terms the name no longer gives", () => {
    const placard = { ocrEnabled: true, placardName: "Computer Lab 2", ocrGeneratedTerms: ["computerlab2"] };
    expect(hasStaleTerms({ roomName: "Computer Lab 2", placard })).toBe(true);
    expect(hasStaleTerms({ roomName: "X", placard: { ...placard, ocrGeneratedTerms: ["computerlab2", "computer lab 2"] } })).toBe(false);
  });
  it("ignores a room that is off", () => {
    expect(hasStaleTerms({ roomName: "A", placard: { ocrEnabled: false, ocrGeneratedTerms: [] } })).toBe(false);
  });
});

describe("ocrCollisions", () => {
  it("finds terms two eligible rooms share", () => {
    const a = withOcrState({ roomName: "Restroom A", placard: {} }, { ocrEnabled: true, placardName: "Restroom", extraTerms: [] });
    const b = withOcrState({ roomName: "Restroom B", placard: {} }, { ocrEnabled: true, placardName: "Restroom", extraTerms: [] });
    const collisions = ocrCollisions([a, b], (r) => r.roomName);
    expect(collisions.get("Restroom A")).toEqual([{ term: "restroom", roomNames: ["Restroom B"] }]);
  });
});

describe("hasOcrPhoto", () => {
  it("is only the room's own AR 360 images, not its photos", () => {
    expect(hasOcrPhoto({ ...OFF, photoPaths: ["room360/gd1/a.webp"] })).toBe(true);
    expect(hasOcrPhoto(OFF)).toBe(false);
  });
});
