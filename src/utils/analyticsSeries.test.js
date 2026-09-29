import { describe, expect, it } from "vitest";
import { fillDateGaps, localToday } from "./analyticsSeries";

const zero = { sessions: 0 };

describe("fillDateGaps", () => {
  it("fills missing days between the first and last returned day", () => {
    const series = [
      { date: "2026-09-01", sessions: 3 },
      { date: "2026-09-04", sessions: 1 },
    ];
    expect(fillDateGaps(series, { zero })).toEqual([
      { date: "2026-09-01", sessions: 3 },
      { date: "2026-09-02", sessions: 0 },
      { date: "2026-09-03", sessions: 0 },
      { date: "2026-09-04", sessions: 1 },
    ]);
  });

  it("extends to the filter range and caps the end at today", () => {
    const series = [{ date: "2026-09-02", sessions: 2 }];
    const result = fillDateGaps(series, { from: "2026-09-01", to: "2026-12-31", today: "2026-09-03", zero });
    expect(result.map((d) => d.date)).toEqual(["2026-09-01", "2026-09-02", "2026-09-03"]);
    expect(result[1].sessions).toBe(2);
  });

  it("crosses a month boundary", () => {
    const series = [
      { date: "2026-02-27", sessions: 1 },
      { date: "2026-03-02", sessions: 1 },
    ];
    expect(fillDateGaps(series, { zero }).map((d) => d.date)).toEqual([
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
      "2026-03-02",
    ]);
  });

  it("returns an empty series unchanged when there's no explicit range", () => {
    expect(fillDateGaps([], { zero })).toEqual([]);
  });
});

describe("localToday", () => {
  it("formats the local calendar date", () => {
    expect(localToday(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });
});
