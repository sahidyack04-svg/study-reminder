export interface TimeRange {
  dayOfWeek: number;
  startTime: string; // "HH:mm"
  endTime: string;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function hasOverlap(entries: TimeRange[]): boolean {
  const byDay = new Map<number, TimeRange[]>();
  for (const entry of entries) {
    const list = byDay.get(entry.dayOfWeek) ?? [];
    list.push(entry);
    byDay.set(entry.dayOfWeek, list);
  }

  for (const dayEntries of byDay.values()) {
    const sorted = [...dayEntries].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
    for (let i = 1; i < sorted.length; i++) {
      if (toMinutes(sorted[i].startTime) < toMinutes(sorted[i - 1].endTime)) {
        return true;
      }
    }
  }
  return false;
}
