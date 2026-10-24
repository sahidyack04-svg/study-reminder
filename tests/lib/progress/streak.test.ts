import { describe, it, expect } from "vitest";
import { computeStreak } from "@/lib/progress/streak";

// Each test's `days` array is ordered from TODAY backward (index 0 = today).
describe("computeStreak", () => {
  it("returns 0 for no history at all", () => {
    expect(computeStreak([])).toBe(0);
  });

  it("skips a day with zero plan entries without breaking the streak", () => {
    const days = [
      { date: new Date("2026-10-17"), entries: [{ checkInStatus: "done" }] }, // today, fully checked in
      { date: new Date("2026-10-16"), entries: [] }, // no entries, skipped
      { date: new Date("2026-10-15"), entries: [{ checkInStatus: "done" }] },
    ];
    expect(computeStreak(days)).toBe(2);
  });

  it("counts a day as a streak day if every entry is checked in, done/partial/not_done all count", () => {
    const days = [
      { date: new Date("2026-10-17"), entries: [{ checkInStatus: "done" }, { checkInStatus: "not_done" }] },
    ];
    expect(computeStreak(days)).toBe(1);
  });

  it("excludes today without breaking the streak when today still has a pending entry", () => {
    const days = [
      { date: new Date("2026-10-17"), entries: [{ checkInStatus: "pending" }] }, // today, not fully checked in yet
      { date: new Date("2026-10-16"), entries: [{ checkInStatus: "done" }] },
      { date: new Date("2026-10-15"), entries: [{ checkInStatus: "done" }] },
    ];
    expect(computeStreak(days)).toBe(2);
  });

  it("ends the streak at the first non-today day with a pending entry", () => {
    const days = [
      { date: new Date("2026-10-17"), entries: [{ checkInStatus: "done" }] },
      { date: new Date("2026-10-16"), entries: [{ checkInStatus: "pending" }] }, // breaks here
      { date: new Date("2026-10-15"), entries: [{ checkInStatus: "done" }] }, // never reached
    ];
    expect(computeStreak(days)).toBe(1);
  });
});

import { computeLongestStreak } from "@/lib/progress/streak";

describe("computeLongestStreak", () => {
  it("finds the longest run even when it isn't the current (most recent) one", () => {
    // today-first order: today is a broken day (pending), but days 3-5 back were a 3-day run
    const days = [
      { date: new Date("2026-10-24"), entries: [{ checkInStatus: "pending" }] },
      { date: new Date("2026-10-23"), entries: [{ checkInStatus: "done" }] },
      { date: new Date("2026-10-22"), entries: [{ checkInStatus: "done" }] },
      { date: new Date("2026-10-21"), entries: [{ checkInStatus: "done" }] },
      { date: new Date("2026-10-20"), entries: [{ checkInStatus: "pending" }] },
    ];
    expect(computeLongestStreak(days)).toBe(3);
  });

  it("returns 0 for an empty history", () => {
    expect(computeLongestStreak([])).toBe(0);
  });

  it("skips zero-entry days without breaking a run, same as computeStreak", () => {
    const days = [
      { date: new Date("2026-10-24"), entries: [{ checkInStatus: "done" }] },
      { date: new Date("2026-10-23"), entries: [] },
      { date: new Date("2026-10-22"), entries: [{ checkInStatus: "done" }] },
    ];
    expect(computeLongestStreak(days)).toBe(2);
  });
});
