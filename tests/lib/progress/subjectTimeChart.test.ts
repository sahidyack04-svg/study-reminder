import { describe, it, expect } from "vitest";
import { computeTimeBySubject } from "@/lib/progress/subjectTimeChart";

describe("computeTimeBySubject", () => {
  it("excludes entries with a null subjectId", () => {
    const result = computeTimeBySubject(
      [{ subjectId: null, subjectName: null, estimatedMinutes: 30, checkInStatus: "done" }],
      );
    expect(result).toEqual([]);
  });

  it("sums planned minutes across every status and actual minutes across done-only", () => {
    const result = computeTimeBySubject([
      { subjectId: "s1", subjectName: "Math", estimatedMinutes: 30, checkInStatus: "done" },
      { subjectId: "s1", subjectName: "Math", estimatedMinutes: 20, checkInStatus: "partial" },
      { subjectId: "s1", subjectName: "Math", estimatedMinutes: 10, checkInStatus: "not_done" },
    ]);
    expect(result).toEqual([{ subjectId: "s1", subjectName: "Math", plannedMinutes: 60, actualMinutes: 30 }]);
  });

  it("shows nonzero planned and zero actual for a subject with no done entries", () => {
    const result = computeTimeBySubject([
      { subjectId: "s2", subjectName: "History", estimatedMinutes: 45, checkInStatus: "partial" },
    ]);
    expect(result).toEqual([{ subjectId: "s2", subjectName: "History", plannedMinutes: 45, actualMinutes: 0 }]);
  });

  it("groups multiple subjects independently", () => {
    const result = computeTimeBySubject([
      { subjectId: "s1", subjectName: "Math", estimatedMinutes: 30, checkInStatus: "done" },
      { subjectId: "s2", subjectName: "History", estimatedMinutes: 20, checkInStatus: "done" },
    ]);
    expect(result).toHaveLength(2);
  });
});
