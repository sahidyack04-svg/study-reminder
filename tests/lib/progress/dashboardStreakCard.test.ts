import { describe, it, expect } from "vitest";
import { summarizeStreakCard } from "@/lib/progress/dashboardStreakCard";

describe("summarizeStreakCard", () => {
  it("gives encouraging copy for a zero current streak with a positive longest streak", () => {
    const text = summarizeStreakCard({ current: 0, longest: 5, totalActiveDays: 12 });
    expect(text).toMatch(/best streak: 5/i);
    expect(text).not.toMatch(/broken|fail/i);
  });

  it("reports the current streak directly when it's active", () => {
    const text = summarizeStreakCard({ current: 4, longest: 4, totalActiveDays: 4 });
    expect(text).toMatch(/4-day/i);
  });
});
