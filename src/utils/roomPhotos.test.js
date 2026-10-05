import { describe, expect, it } from "vitest";
import { focusPosition, isPanorama, moveItem, roomPhotos } from "./roomPhotos";

describe("roomPhotos", () => {
  it("returns the photos in their saved order", () => {
    const photos = [{ path: "b.webp", kind: "360", x: 50, y: 50 }, { path: "a.webp", kind: "flat", x: 10, y: 20 }];
    expect(roomPhotos({ photos })).toBe(photos);
  });

  it("is empty for a missing placard or one without photos", () => {
    expect(roomPhotos(null)).toEqual([]);
    expect(roomPhotos({})).toEqual([]);
  });
});

describe("isPanorama", () => {
  it("is true only for the 360 kind", () => {
    expect(isPanorama({ kind: "360" })).toBe(true);
    expect(isPanorama({ kind: "flat" })).toBe(false);
    expect(isPanorama(undefined)).toBe(false);
  });
});

describe("moveItem", () => {
  it("moves an item to a new position and keeps the rest in order", () => {
    expect(moveItem(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"]);
  });

  it("returns the list untouched for a no-op or out-of-range move", () => {
    const list = ["a", "b"];
    expect(moveItem(list, 1, 1)).toBe(list);
    expect(moveItem(list, 0, 5)).toBe(list);
    expect(moveItem(list, -1, 0)).toBe(list);
  });
});

describe("focusPosition", () => {
  it("formats a focus as object-position and centers when unset", () => {
    expect(focusPosition({ x: 10, y: 90 })).toBe("10% 90%");
    expect(focusPosition(undefined)).toBe("50% 50%");
  });
});
