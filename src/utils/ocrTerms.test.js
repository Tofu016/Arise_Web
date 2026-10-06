import { describe, it, expect } from "vitest";
import {
  spacedOcrForm,
  compactOcrForm,
  bareOcrForm,
  generateOcrTerms,
  normalizeExtraTerm,
  effectivePlacardName,
  isOcrEligible,
  ocrTermsForRoom,
  generatedTermsStale,
  findTermCollisions,
} from "./ocrTerms";

describe("spacedOcrForm", () => {
  it("lowercases and keeps dashes and apostrophes", () => {
    expect(spacedOcrForm("GD1-101")).toBe("gd1-101");
    expect(spacedOcrForm("Dean's Office")).toBe("dean's office");
  });
  it("folds accented letters to plain ones", () => {
    expect(spacedOcrForm("Café Élan")).toBe("cafe elan");
    expect(spacedOcrForm("Niño")).toBe("nino");
    expect(spacedOcrForm("Straße")).toBe("strasse");
    expect(spacedOcrForm("Ærø")).toBe("aero");
  });
  it("reads every dash and apostrophe character as the plain one", () => {
    expect(spacedOcrForm("GD1–101")).toBe("gd1-101");
    expect(spacedOcrForm("GD1—101")).toBe("gd1-101");
    expect(spacedOcrForm("GD1−101")).toBe("gd1-101");
    expect(spacedOcrForm("Dean’s")).toBe("dean's");
    expect(spacedOcrForm("Dean′s")).toBe("dean's");
  });
  it("drops other symbols, as word breaks", () => {
    expect(spacedOcrForm("Rm. 203 (Lab/Office)")).toBe("rm 203 lab office");
    expect(spacedOcrForm("#203!")).toBe("203");
  });
  it("closes up spaces around a dash or apostrophe and collapses repeats", () => {
    expect(spacedOcrForm("GD1 - 101")).toBe("gd1-101");
    expect(spacedOcrForm("GD1--101")).toBe("gd1-101");
    expect(spacedOcrForm("Dean ' s")).toBe("dean's");
    expect(spacedOcrForm("  Computer   Lab  ")).toBe("computer lab");
  });
  it("drops a dash or apostrophe left at either end", () => {
    expect(spacedOcrForm("- GD1-101 -")).toBe("gd1-101");
    expect(spacedOcrForm("'Lab'")).toBe("lab");
  });
  it("copes with missing values", () => {
    expect(spacedOcrForm(undefined)).toBe("");
    expect(spacedOcrForm("--")).toBe("");
  });
});

describe("compactOcrForm and bareOcrForm", () => {
  it("compact drops spaces, bare also drops dashes and apostrophes", () => {
    expect(compactOcrForm("Dean's Office")).toBe("dean'soffice");
    expect(bareOcrForm("Dean's Office")).toBe("deansoffice");
    expect(compactOcrForm("GD1 101")).toBe("gd1101");
    expect(bareOcrForm("GD1-101")).toBe("gd1101");
  });
});

describe("generateOcrTerms", () => {
  it("gives compact and bare forms, compact first", () => {
    expect(generateOcrTerms("GD1-101")).toEqual(["gd1-101", "gd1101"]);
  });
  it("adds the spaced form for a name of several words", () => {
    expect(generateOcrTerms("Dean's Office")).toEqual(["dean'soffice", "deansoffice", "dean's office"]);
  });
  it("gives one term when every form is the same", () => {
    expect(generateOcrTerms("Canteen")).toEqual(["canteen"]);
  });
  it("matches the bare term the old Room Editor stored", () => {
    // The old rule was toLowerCase().replace(/[^a-z0-9]/g, ""), which
    // app builds from before OCR Management still compare against.
    for (const name of ["GD1-101", "Computer Lab 2", "Registrar's Office"]) {
      expect(generateOcrTerms(name)).toContain(name.toLowerCase().replace(/[^a-z0-9]/g, ""));
    }
  });
  it("gives nothing for a name with no letters or digits", () => {
    expect(generateOcrTerms("  -- ")).toEqual([]);
    expect(generateOcrTerms("")).toEqual([]);
  });
});

describe("normalizeExtraTerm", () => {
  it("stores an extra term in compact form", () => {
    expect(normalizeExtraTerm(" GD1–1O1 ")).toBe("gd1-1o1");
  });
});

describe("effectivePlacardName", () => {
  it("prefers the Placard name and falls back to the room name", () => {
    expect(effectivePlacardName({ placardName: "Rm 101" }, "Room 101")).toBe("Rm 101");
    expect(effectivePlacardName({ placardName: "  " }, "Room 101")).toBe("Room 101");
    expect(effectivePlacardName(null, "Room 101")).toBe("Room 101");
  });
});

describe("isOcrEligible", () => {
  it("needs a placard record with OCR switched on", () => {
    expect(isOcrEligible({ placard: { ocrEnabled: true } })).toBe(true);
    expect(isOcrEligible({ placard: { ocrEnabled: false } })).toBe(false);
    expect(isOcrEligible({ placard: null })).toBe(false);
  });
});

describe("ocrTermsForRoom", () => {
  it("joins the stored terms with the ones the Placard name generates", () => {
    const room = { roomName: "Room 101", placard: { placardName: "GD1-101", ocrSearchTerms: ["gd1101", "rm101"] } };
    expect(ocrTermsForRoom(room)).toEqual(["gd1101", "rm101", "gd1-101"]);
  });
  it("uses the room name when there is no Placard name", () => {
    expect(ocrTermsForRoom({ roomName: "Canteen", placard: null })).toEqual(["canteen"]);
  });
});

describe("generatedTermsStale", () => {
  it("is false when the stored terms are what the name generates, in any order", () => {
    expect(generatedTermsStale(["gd1101", "gd1-101"], "GD1-101")).toBe(false);
  });
  it("is true for terms in the old format or from another name", () => {
    expect(generatedTermsStale(["computerlab2"], "Computer Lab 2")).toBe(true);
    expect(generatedTermsStale(["canteen"], "Cafeteria")).toBe(true);
    expect(generatedTermsStale([], "Canteen")).toBe(true);
  });
});

describe("findTermCollisions", () => {
  it("names the other rooms sharing a term, by compact form", () => {
    const collisions = findTermCollisions([
      { key: "A", roomName: "Restroom A", terms: ["restroom", "restrooma"] },
      { key: "B", roomName: "Restroom B", terms: ["rest room"] },
      { key: "C", roomName: "Canteen", terms: ["canteen"] },
    ]);
    expect(collisions.get("A")).toEqual([{ term: "restroom", roomNames: ["Restroom B"] }]);
    expect(collisions.get("B")).toEqual([{ term: "restroom", roomNames: ["Restroom A"] }]);
    expect(collisions.has("C")).toBe(false);
  });
  it("does not count a room's own repeated term", () => {
    const collisions = findTermCollisions([{ key: "A", roomName: "Lab", terms: ["lab", "lab"] }]);
    expect(collisions.size).toBe(0);
  });
  it("keeps dashed terms apart from their bare twins", () => {
    const collisions = findTermCollisions([
      { key: "A", roomName: "GD1-101", terms: ["gd1-101"] },
      { key: "B", roomName: "GD11-01", terms: ["gd11-01"] },
    ]);
    expect(collisions.size).toBe(0);
  });
});
