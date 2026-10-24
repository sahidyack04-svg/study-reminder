import type { DayEntries } from "./completionChart";

function isFullyCheckedIn(day: DayEntries): boolean {
  return day.entries.length > 0 && day.entries.every((e) => e.checkInStatus !== "pending");
}

function hasPending(day: DayEntries): boolean {
  return day.entries.some((e) => e.checkInStatus === "pending");
}

/** `days` must be ordered from today backward (index 0 = today). */
export function computeStreak(days: DayEntries[]): number {
  let streak = 0;

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const isToday = i === 0;

    if (day.entries.length === 0) {
      continue; // skip, neither extends nor breaks
    }

    if (isFullyCheckedIn(day)) {
      streak += 1;
      continue;
    }

    if (hasPending(day)) {
      if (isToday) {
        continue; // today not yet countable, but doesn't break the streak
      }
      break; // a past day with an unchecked entry ends the streak
    }
  }

  return streak;
}

/**
 * Find the longest consecutive streak in history, where every day counts equally
 * (no "today exception" like computeStreak has).
 * `days` must be ordered from today backward (index 0 = today).
 */
export function computeLongestStreak(days: DayEntries[]): number {
  let longest = 0;
  let currentRun = 0;

  for (let i = 0; i < days.length; i++) {
    const day = days[i];

    if (day.entries.length === 0) {
      continue; // skip, neither extends nor breaks
    }

    if (isFullyCheckedIn(day)) {
      currentRun += 1;
      longest = Math.max(longest, currentRun);
      continue;
    }

    if (hasPending(day)) {
      // Any pending entry resets the run (no today exception)
      currentRun = 0;
    }
  }

  return longest;
}
