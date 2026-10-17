export interface DayEntries {
  date: Date;
  entries: { checkInStatus: string }[];
}

export interface CompletionPoint {
  date: Date;
  percentDone: number;
}

export function computeDailyCompletion(days: DayEntries[]): CompletionPoint[] {
  return days
    .filter((day) => day.entries.length > 0)
    .map((day) => {
      const doneCount = day.entries.filter((e) => e.checkInStatus === "done").length;
      return { date: day.date, percentDone: Math.round((doneCount / day.entries.length) * 100) };
    });
}
