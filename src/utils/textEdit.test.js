import { describe, it, expect } from "vitest";
import { insertAt, backspaceAt } from "./textEdit";

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
