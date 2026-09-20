import { describe, it, expect } from "vitest";
import { normalize, allowedEdits, approximateSubstringDistance, matchScore, fuzzyIncludes } from "./fuzzy";

describe("normalize", () => {
  it("ignores case, spaces, punctuation and accents", () => {
    expect(normalize("  Main  Entrance ")).toBe("mainentrance");
    expect(normalize("203-A")).toBe("203a");
    expect(normalize("Registrar's Office")).toBe("registrarsoffice");
    expect(normalize("Café")).toBe("cafe");
  });
  it("copes with missing values", () => {
    expect(normalize(undefined)).toBe("");
    expect(normalize(null)).toBe("");
  });
});

describe("allowedEdits", () => {
  it("scales with length and never applies to anything with a digit", () => {
    expect(allowedEdits("lab")).toBe(0);
    expect(allowedEdits("hall")).toBe(1);
    expect(allowedEdits("library")).toBe(2);
    expect(allowedEdits("gd2lab")).toBe(0);
    expect(allowedEdits("203")).toBe(0);
  });
});

describe("approximateSubstringDistance", () => {
  it("is 0 when the query is inside the text", () => {
    expect(approximateSubstringDistance("hall", "mainhallway")).toBe(0);
  });
  it("counts a substitution, an insertion, a deletion", () => {
    expect(approximateSubstringDistance("hell", "hall")).toBe(1);
    expect(approximateSubstringDistance("halll", "hall")).toBe(1);
    expect(approximateSubstringDistance("hal", "hall")).toBe(0);
    expect(approximateSubstringDistance("hxall", "hall")).toBe(1);
  });
  it("counts swapping two adjacent letters as one edit", () => {
    expect(approximateSubstringDistance("entrnace", "mainentrance")).toBe(1);
  });
});

describe("matchScore", () => {
  it("ranks identical, then prefix, then contains, then typos", () => {
    const q = normalize("hall");
    const scores = ["Hall", "Hallway", "Main Hall", "Hell"].map((t) => matchScore(q, t));
    expect(scores).toEqual([0, 10, 20, 31]);
  });
  it("ignores spaces and case in the query too", () => {
    expect(matchScore(normalize("MAIN entrance"), "Main Entrance")).toBe(0);
  });
  it("does not bend on short queries or anything with a digit", () => {
    expect(matchScore(normalize("lab"), "lob")).toBe(Infinity);
    expect(matchScore(normalize("203"), "208")).toBe(Infinity);
    expect(matchScore(normalize("gd2lab"), "gd3lab")).toBe(Infinity);
  });
  it("respects the typo budget", () => {
    expect(matchScore(normalize("libary"), "Library")).toBe(31);
    expect(matchScore(normalize("lirary"), "Library")).toBe(31); // one missing letter
    expect(matchScore(normalize("lxxary"), "Library")).toBe(Infinity); // too far for 6 letters
  });
  it("can be told not to be fuzzy", () => {
    expect(matchScore(normalize("hell"), "Hall", { fuzzy: false })).toBe(Infinity);
  });
  it("matches nothing for an empty query", () => {
    expect(matchScore("", "anything")).toBe(Infinity);
  });
});

describe("fuzzyIncludes", () => {
  it("treats a blank query as matching everything", () => {
    expect(fuzzyIncludes("  ", ["x"])).toBe(true);
  });
  it("matches any of several texts", () => {
    expect(fuzzyIncludes("regstrar", ["gd1_f1_01", "Registrar"])).toBe(true);
    expect(fuzzyIncludes("zzzz", ["gd1_f1_01", "Registrar"])).toBe(false);
  });
});
