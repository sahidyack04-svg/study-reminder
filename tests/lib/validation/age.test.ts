import { describe, it, expect, vi, afterEach } from "vitest";
import {
  calculateAge,
  requiresGuardianConsent,
  todayInTimezone,
  currentTimeInTimezone,
  formatUTCDate,
} from "@/lib/validation/age";

describe("age calculations", () => {
  it("calculates age correctly before a birthday has passed this year", () => {
    expect(calculateAge(new Date("2010-12-25"), new Date("2026-10-14"))).toBe(15);
  });

  it("calculates age correctly on the birthday itself", () => {
    expect(calculateAge(new Date("2008-10-14"), new Date("2026-10-14"))).toBe(18);
  });

  it("does not require guardian consent for a student turning exactly 18 today", () => {
    expect(requiresGuardianConsent(new Date("2008-10-14"), new Date("2026-10-14"))).toBe(false);
  });

  it("requires guardian consent for a student turning 18 tomorrow", () => {
    expect(requiresGuardianConsent(new Date("2008-10-15"), new Date("2026-10-14"))).toBe(true);
  });
});

describe("todayInTimezone", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("computes the calendar date in the GIVEN timezone, not the host/UTC timezone", () => {
    // Pin "now" to a single UTC instant that falls on different calendar
    // dates depending on which timezone you read it in: Pacific/Kiritimati
    // is UTC+14 (already into Oct 15 locally), while Etc/GMT+12 is UTC-12
    // (still on Oct 14 locally). If todayInTimezone silently fell back to
    // host time or plain UTC, both calls would return the same date.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-14T23:00:00.000Z"));

    const aheadOfUtc = todayInTimezone("Pacific/Kiritimati");
    const behindUtc = todayInTimezone("Etc/GMT+12");

    expect(aheadOfUtc.toISOString().slice(0, 10)).toBe("2026-10-15");
    expect(behindUtc.toISOString().slice(0, 10)).toBe("2026-10-14");
  });
});

describe("currentTimeInTimezone", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats the current time in the given timezone as a 24-hour HH:mm string", () => {
    // Same pinned instant as the todayInTimezone test above: 23:00 UTC,
    // which is 13:00 the next day in Pacific/Kiritimati (UTC+14).
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-14T23:15:00.000Z"));

    expect(currentTimeInTimezone("UTC")).toBe("23:15");
    expect(currentTimeInTimezone("Pacific/Kiritimati")).toBe("13:15");
  });
});

describe("formatUTCDate", () => {
  it("formats a UTC-midnight-anchored calendar date as the same calendar day, regardless of host timezone", () => {
    // 2026-01-05T00:00:00.000Z is the calendar date Jan 5 everywhere it's
    // meant to represent (it's a date-only value, not a real instant).
    // toLocaleDateString() with no timeZone option would read it back in
    // the host process's local timezone instead, which can roll it back
    // to Jan 4 west of UTC -- the exact off-by-one this helper exists to
    // prevent, independent of whatever TZ this test suite happens to run in.
    const date = new Date("2026-01-05T00:00:00.000Z");
    expect(formatUTCDate(date)).toBe(date.toLocaleDateString(undefined, { timeZone: "UTC" }));
    expect(formatUTCDate(date)).toContain("2026");
  });
});
