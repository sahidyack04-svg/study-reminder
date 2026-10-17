export interface SubjectEntry {
  subjectId: string | null;
  subjectName: string | null;
  estimatedMinutes: number;
  checkInStatus: string;
}

export interface SubjectTimePoint {
  subjectId: string;
  subjectName: string;
  plannedMinutes: number;
  actualMinutes: number;
}

export function computeTimeBySubject(entries: SubjectEntry[]): SubjectTimePoint[] {
  const bySubject = new Map<string, SubjectTimePoint>();

  for (const entry of entries) {
    if (!entry.subjectId) continue;

    const existing = bySubject.get(entry.subjectId) ?? {
      subjectId: entry.subjectId,
      subjectName: entry.subjectName ?? "Unknown subject",
      plannedMinutes: 0,
      actualMinutes: 0,
    };

    existing.plannedMinutes += entry.estimatedMinutes;
    if (entry.checkInStatus === "done") {
      existing.actualMinutes += entry.estimatedMinutes;
    }

    bySubject.set(entry.subjectId, existing);
  }

  return Array.from(bySubject.values());
}
