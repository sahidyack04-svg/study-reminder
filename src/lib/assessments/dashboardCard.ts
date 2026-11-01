export function summarizeMostRecentTest(
  tests: { subjectName: string; scorePercent: number | null; createdAt: Date }[],
): string {
  if (tests.length === 0) return "No tests yet.";
  const mostRecent = tests[0]; // listTests already orders newest-first
  return `Most recent: ${mostRecent.subjectName}, ${mostRecent.scorePercent}%.`;
}
