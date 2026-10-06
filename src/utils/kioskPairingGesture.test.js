import { describe, it, expect } from "vitest";
import { advanceGesture, initialGesture, MOBILE_GESTURE, TAP_WINDOW_MS, STEP_GAP_MS } from "./kioskPairingGesture";

// Feeds taps ({ target, at }) through the gesture; returns the last result
// and whether any tap completed it.
function run(taps) {
  let state = initialGesture;
  let completed = false;
  for (const { target, at } of taps) {
    const next = advanceGesture(state, target, at);
    state = next.state;
    completed = completed || next.complete;
  }
  return { state, completed };
}

const burst = (target, startAt, n = 5, gap = 200) =>
  Array.from({ length: n }, (_, i) => ({ target, at: startAt + i * gap }));

describe("advanceGesture", () => {
  it("completes on 5 logo, 5 title, 5 signage taps in order", () => {
    const taps = [...burst("logo", 0), ...burst("title", 2000), ...burst("signage", 4000)];
    expect(run(taps).completed).toBe(true);
  });

  it("does not complete when the steps are out of order", () => {
    const taps = [...burst("title", 0), ...burst("logo", 2000), ...burst("signage", 4000)];
    expect(run(taps).completed).toBe(false);
  });

  it("needs all 5 taps of a step inside the tap window", () => {
    const slow = burst("logo", 0, 5, TAP_WINDOW_MS / 2);
    const taps = [...slow, ...burst("title", 20000), ...burst("signage", 22000)];
    expect(run(taps).completed).toBe(false);
  });

  it("starts over when the next step takes too long to begin", () => {
    const taps = [...burst("logo", 0), ...burst("title", STEP_GAP_MS + 5000), ...burst("signage", STEP_GAP_MS + 7000)];
    expect(run(taps).completed).toBe(false);
  });

  it("starts over on a tap somewhere else mid-sequence", () => {
    const taps = [...burst("logo", 0), ...burst("title", 2000), { target: "other", at: 4000 }, ...burst("signage", 4500)];
    expect(run(taps).completed).toBe(false);
  });

  it("lets a wrong-target tap that is the logo begin a fresh run", () => {
    const taps = [...burst("logo", 0, 2), ...burst("title", 1000, 1), ...burst("logo", 2000), ...burst("title", 4000), ...burst("signage", 6000)];
    expect(run(taps).completed).toBe(true);
  });

  it("ignores extra taps on the step just finished", () => {
    const taps = [...burst("logo", 0, 8), ...burst("title", 2000, 7), ...burst("signage", 4000)];
    expect(run(taps).completed).toBe(true);
  });

  it("resets after completing so it can be done again", () => {
    const taps = [...burst("logo", 0), ...burst("title", 2000), ...burst("signage", 4000)];
    expect(run(taps).state).toEqual(initialGesture);
  });
});

describe("advanceGesture with the mobile gesture", () => {
  function runMobile(taps) {
    let state = initialGesture;
    let completed = false;
    for (const { target, at } of taps) {
      const next = advanceGesture(state, target, at, MOBILE_GESTURE);
      state = next.state;
      completed = completed || next.complete;
    }
    return { state, completed };
  }

  it("completes on 5 logo taps, 5 title taps, then a single help tap", () => {
    const taps = [...burst("logo", 0), ...burst("title", 3000), { target: "help", at: 7000 }];
    expect(runMobile(taps).completed).toBe(true);
  });

  it("does not complete on a help tap alone, which just replays the tips", () => {
    expect(runMobile([{ target: "help", at: 0 }]).completed).toBe(false);
  });

  it("does not complete when help comes before the title step is done", () => {
    const taps = [...burst("logo", 0), ...burst("title", 2000, 3), { target: "help", at: 4000 }];
    expect(runMobile(taps).completed).toBe(false);
  });

  it("starts over when the help tap comes too long after the title step", () => {
    const taps = [...burst("logo", 0), ...burst("title", 2000), { target: "help", at: 2800 + STEP_GAP_MS + 1 }];
    expect(runMobile(taps).completed).toBe(false);
  });
});
