import type { StreakStats } from "./progressService";

export function summarizeStreakCard(stats: StreakStats): string {
  if (stats.current > 0) return `${stats.current}-day check-in streak.`;
  if (stats.longest > 0) return `Your best streak: ${stats.longest} days — start a new one today.`;
  return "No check-in streak yet — visit your plan to get started.";
}
