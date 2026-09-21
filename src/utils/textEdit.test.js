import { describe, it, expect } from "vitest";
import { insertAt, backspaceAt, shouldCapitalize } from "./textEdit";

describe("insertAt", () => {
  it("inserts at the caret", () => {
    expect(insertAt("ac", 1, 1, "b")).toEqual({ value: "abc", caret: 2 });
  });
  it("replaces a selection", () => {
    expect(insertAt("abcd", 1, 3, "X")).toEqual({ value: "aXd", caret: 2 });
  });
  it("appends at the end", () => {
    expect(insertAt("ab", 2, 2, "c")).toEqual({ value: "abc", caret: 3 });
  });
});

describe("backspaceAt", () => {
  it("removes the character before the caret", () => {
    expect(backspaceAt("abc", 2, 2)).toEqual({ value: "ac", caret: 1 });
  });
  it("removes a selection", () => {
    expect(backspaceAt("abcd", 1, 3)).toEqual({ value: "ad", caret: 1 });
  });
  it("does nothing at the start", () => {
    expect(backspaceAt("abc", 0, 0)).toEqual({ value: "abc", caret: 0 });
  });
});

describe("shouldCapitalize", () => {
  it("words: at the start, after a space or a dash, but not after an apostrophe", () => {
    expect(shouldCapitalize("", 0, "words")).toBe(true);
    expect(shouldCapitalize("Room ", 5, "words")).toBe(true);
    expect(shouldCapitalize("Jean-", 5, "words")).toBe(true);
    expect(shouldCapitalize("Don'", 4, "words")).toBe(false);
    expect(shouldCapitalize("Room", 4, "words")).toBe(false);
  });

  it("words: follows the caret, not the end of the text", () => {
    expect(shouldCapitalize("Room 203", 5, "words")).toBe(true);
    expect(shouldCapitalize("Room 203", 2, "words")).toBe(false);
  });

  it("sentences: the first letter and the first after . ! ? and a space", () => {
    expect(shouldCapitalize("", 0, "sentences")).toBe(true);
    expect(shouldCapitalize("  ", 2, "sentences")).toBe(true);
    expect(shouldCapitalize("Good. ", 6, "sentences")).toBe(true);
    expect(shouldCapitalize("Really? ", 8, "sentences")).toBe(true);
    expect(shouldCapitalize('He said "wow!" ', 15, "sentences")).toBe(true);
    expect(shouldCapitalize("Good, ", 6, "sentences")).toBe(false);
    expect(shouldCapitalize("Good", 4, "sentences")).toBe(false);
  });

  it("sentences: no capital straight after the mark, so addresses and decimals survive", () => {
    expect(shouldCapitalize("example.", 8, "sentences")).toBe(false);
    expect(shouldCapitalize("3.", 2, "sentences")).toBe(false);
  });
});
