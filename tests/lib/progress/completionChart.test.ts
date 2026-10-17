import { describe, it, expect } from "vitest";
import { computeDailyCompletion } from "@/lib/progress/completionChart";

describe("computeDailyCompletion", () => {
  it("excludes a day with zero plan entries entirely", () => {
    const result = computeDailyCompletion([
      { date: new Date("2026-10-15"), entries: [] },
      { date: new Date("2026-10-16"), entries: [{ checkInStatus: "done" }] },
    ]);
    expect(result).toEqual([{ date: new Date("2026-10-16"), percentDone: 100 }]);
  });

  it("computes the percentage of done entries out of all entries that day", () => {
    const result = computeDailyCompletion([
      {
        date: new Date("2026-10-16"),
        entries: [{ checkInStatus: "done" }, { checkInStatus: "done" }, { checkInStatus: "pending" }, { checkInStatus: "not_done" }],
      },
    ]);
    expect(result).toEqual([{ date: new Date("2026-10-16"), percentDone: 50 }]);
  });

  it("returns 0% for a day whose entries are all still pending, not excluded", () => {
    const result = computeDailyCompletion([
      { date: new Date("2026-10-16"), entries: [{ checkInStatus: "pending" }] },
    ]);
    expect(result).toEqual([{ date: new Date("2026-10-16"), percentDone: 0 }]);
  });

  it("returns an empty array for an empty window", () => {
    expect(computeDailyCompletion([])).toEqual([]);
  });
});
