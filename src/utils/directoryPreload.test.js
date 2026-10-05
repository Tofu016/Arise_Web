import { describe, expect, it } from "vitest";
import { planDirectoryPreload } from "./directoryPreload";
import { DEFAULT_DIRECTORY_SETTINGS } from "./directorySettings";

const room = (name, building, path, kind = "flat") => ({
  roomName: name,
  node: { building },
  placard: path ? { photos: [{ path, kind }] } : null,
});

describe("planDirectoryPreload", () => {
  const buildings = [{ id: "a" }, { id: "b" }];
  const rooms = [
    room("1", "a", "a1.webp"),
    room("2", "a", "a2.webp", "360"),
    room("3", "a", "a3.webp"),
    room("4", "b", "b1.webp"),
    room("5", "b", null),
    room("6", "b", "b3.webp"),
  ];

  it("puts each building's first rooms ahead of the remainder", () => {
    const { first, rest } = planDirectoryPreload(rooms, buildings, DEFAULT_DIRECTORY_SETTINGS, 2);
    expect(first.map((p) => p.path)).toEqual(["a1.webp", "a2.webp", "b1.webp"]);
    expect(rest.map((p) => p.path)).toEqual(["a3.webp", "b3.webp"]);
  });

  it("counts a room without photos as one of the first few, so a building does not borrow from its tail", () => {
    const { first } = planDirectoryPreload(rooms, buildings, DEFAULT_DIRECTORY_SETTINGS, 2);
    expect(first.map((p) => p.path)).not.toContain("b3.webp");
  });

  it("skips hidden buildings and repeated photos", () => {
    const settings = { ...DEFAULT_DIRECTORY_SETTINGS, hiddenBuildings: ["b"] };
    const dup = [...rooms, room("7", "a", "a1.webp")];
    const { first, rest } = planDirectoryPreload(dup, buildings, settings, 4);
    expect([...first, ...rest].map((p) => p.path)).toEqual(["a1.webp", "a2.webp", "a3.webp"]);
  });
});
