import { describe, it, expect } from "vitest";
import { hasOverlap } from "@/lib/validation/timetable";

describe("hasOverlap", () => {
  it("returns false for entries on different days at the same time", () => {
    expect(
      hasOverlap([
        { dayOfWeek: 1, startTime: "09:00", endTime: "10:00" },
        { dayOfWeek: 2, startTime: "09:00", endTime: "10:00" },
      ]),
    ).toBe(false);
  });

  it("returns false for back-to-back entries on the same day", () => {
    expect(
      hasOverlap([
        { dayOfWeek: 1, startTime: "09:00", endTime: "10:00" },
        { dayOfWeek: 1, startTime: "10:00", endTime: "11:00" },
      ]),
    ).toBe(false);
  });

  it("returns true for a partial overlap on the same day", () => {
    expect(
      hasOverlap([
        { dayOfWeek: 1, startTime: "09:00", endTime: "10:30" },
        { dayOfWeek: 1, startTime: "10:00", endTime: "11:00" },
      ]),
    ).toBe(true);
  });

  it("returns true for fully contained overlapping entries", () => {
    expect(
      hasOverlap([
        { dayOfWeek: 1, startTime: "09:00", endTime: "12:00" },
        { dayOfWeek: 1, startTime: "10:00", endTime: "11:00" },
      ]),
    ).toBe(true);
  });
});
