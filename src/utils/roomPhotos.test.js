import { describe, expect, it } from "vitest";
import { focusPosition, roomPhotoFocus, roomPhotos } from "./roomPhotos";

describe("roomPhotos", () => {
  it("is empty for a room with no record or no photos", () => {
    expect(roomPhotos(null)).toEqual([]);
    expect(roomPhotos({})).toEqual([]);
  });

  it("puts the main photo before the extras", () => {
    expect(roomPhotos({ photo: "a.webp", extraPhotos: [{ path: "b.webp" }, { path: "c.webp" }] })).toEqual(["a.webp", "b.webp", "c.webp"]);
  });

  it("uses extras alone when there is no main photo", () => {
    expect(roomPhotos({ photo: "", extraPhotos: [{ path: "b.webp" }] })).toEqual(["b.webp"]);
  });

  it("drops an extra that repeats the main photo", () => {
    expect(roomPhotos({ photo: "a.webp", extraPhotos: [{ path: "a.webp" }, { path: "b.webp" }] })).toEqual(["a.webp", "b.webp"]);
  });
});

describe("roomPhotoFocus", () => {
  it("maps each photo to its own focus, the main photo included", () => {
    const placard = { photo: "a.webp", photoFocus: { x: 10, y: 20 }, extraPhotos: [{ path: "b.webp", x: 70, y: 30 }] };
    expect(roomPhotoFocus(placard)).toEqual({ "a.webp": { x: 10, y: 20 }, "b.webp": { x: 70, y: 30 } });
  });

  it("centers a main photo with no stored focus", () => {
    expect(roomPhotoFocus({ photo: "a.webp" })).toEqual({ "a.webp": { x: 50, y: 50 } });
  });
});

describe("focusPosition", () => {
  it("formats as an object-position and defaults to the center", () => {
    expect(focusPosition({ x: 25, y: 80 })).toBe("25% 80%");
    expect(focusPosition(undefined)).toBe("50% 50%");
  });
});
