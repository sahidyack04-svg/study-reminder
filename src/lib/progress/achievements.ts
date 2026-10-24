export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100] as const;

export interface Achievement {
  days: number;
  unlocked: boolean;
}

/**
 * Compute achievement unlock status based on the longest streak ever reached.
 * Returns one achievement entry per milestone, in order.
 */
export function computeAchievements(longestStreakEver: number): Achievement[] {
  return STREAK_MILESTONES.map((days) => ({
    days,
    unlocked: longestStreakEver >= days,
  }));
}
