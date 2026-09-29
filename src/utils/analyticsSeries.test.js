import { describe, expect, it } from "vitest";
import { defaultDateRange, fillDateGaps, kpiDelta, localToday, niceTicks, previousPeriod } from "./analyticsSeries";

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

describe("defaultDateRange", () => {
  it("covers the last 30 days including today", () => {
    expect(defaultDateRange("2026-09-29")).toEqual({ from: "2026-08-31", to: "2026-09-29" });
  });
});

describe("previousPeriod", () => {
  it("returns the equally long stretch right before the range", () => {
    expect(previousPeriod({ from: "2026-09-01", to: "2026-09-30" })).toEqual({
      from: "2026-08-02",
      to: "2026-08-31",
    });
  });

  it("handles a single-day range", () => {
    expect(previousPeriod({ from: "2026-03-01", to: "2026-03-01" })).toEqual({
      from: "2026-02-28",
      to: "2026-02-28",
    });
  });

  it("is null for an open-ended or inverted range", () => {
    expect(previousPeriod({ from: "2026-09-01", to: "" })).toBeNull();
    expect(previousPeriod({ from: "", to: "2026-09-01" })).toBeNull();
    expect(previousPeriod({ from: "2026-09-10", to: "2026-09-01" })).toBeNull();
  });
});

describe("kpiDelta", () => {
  it("reports a relative change with an arrow and tone", () => {
    expect(kpiDelta(105, 100)).toEqual({ label: "\u2191 5%", tone: "good" });
    expect(kpiDelta(50, 100)).toEqual({ label: "\u2193 50%", tone: "bad" });
  });

  it("flips tone when lower is better", () => {
    expect(kpiDelta(80, 100, { higherIsBetter: false }).tone).toBe("good");
  });

  it("reports rates as percentage points", () => {
    expect(kpiDelta(0.25, 0.2, { kind: "points" })).toEqual({ label: "\u2191 5 pts", tone: "good" });
  });

  it("says no change when the rounded change is zero", () => {
    expect(kpiDelta(100, 100)).toEqual({ label: "No change", tone: "neutral" });
  });

  it("has no baseline when the previous value is zero or missing", () => {
    expect(kpiDelta(10, 0)).toBeNull();
    expect(kpiDelta(10, null)).toBeNull();
    expect(kpiDelta(null, 10)).toBeNull();
  });
});

describe("niceTicks", () => {
  it("steps on round numbers that cover the max", () => {
    expect(niceTicks(14)).toEqual([0, 5, 10, 15]);
    expect(niceTicks(80)).toEqual([0, 20, 40, 60, 80]);
  });

  it("never steps below 1 for small or zero counts", () => {
    expect(niceTicks(0)).toEqual([0, 1]);
    expect(niceTicks(2)).toEqual([0, 1, 2]);
  });
});
