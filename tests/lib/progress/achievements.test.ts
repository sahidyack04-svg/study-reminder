import { describe, it, expect } from "vitest";
import { computeAchievements, STREAK_MILESTONES } from "@/lib/progress/achievements";

describe("computeAchievements", () => {
  it("unlocks every milestone at or below the longest streak ever reached", () => {
    const result = computeAchievements(14);
    expect(result.find((a) => a.days === 14)?.unlocked).toBe(true);
    expect(result.find((a) => a.days === 7)?.unlocked).toBe(true);
    expect(result.find((a) => a.days === 30)?.unlocked).toBe(false);
  });

  it("returns one entry per milestone, locked, for a streak of 0", () => {
    const result = computeAchievements(0);
    expect(result).toHaveLength(STREAK_MILESTONES.length);
    expect(result.every((a) => !a.unlocked)).toBe(true);
  });
});
