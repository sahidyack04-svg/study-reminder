import { describe, it, expect } from "vitest";
import { summarizeMostRecentTest } from "@/lib/assessments/dashboardCard";

describe("summarizeMostRecentTest", () => {
  it("returns an honest no-tests message for an empty list", () => {
    expect(summarizeMostRecentTest([])).toBe("No tests yet.");
  });

  it("summarizes the most recent test's subject and score", () => {
    const tests = [{ subjectName: "Math", scorePercent: 80, createdAt: new Date("2026-10-01") }];
    expect(summarizeMostRecentTest(tests)).toBe("Most recent: Math, 80%.");
  });
});
