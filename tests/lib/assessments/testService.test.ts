import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => {
  const prisma: any = {
    studentProfile: { findUnique: vi.fn() },
    subject: { findUnique: vi.fn() },
    question: { findMany: vi.fn() },
    test: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    testAnswer: { createMany: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
  };
  // Same convention as tests/lib/plan/planService.test.ts: the real
  // $transaction wraps a check-then-write sequence so the DB can serialize
  // concurrent callers. For tests, `tx` is just `prisma` itself -- we only
  // care that the right calls happen in the right order, not that tx is a
  // distinct client. Set here (not in a beforeEach) so `vi.clearAllMocks()`,
  // which clears calls but not implementations, can't strip it.
  prisma.$transaction.mockImplementation((callback: any) => callback(prisma));
  return { prisma };
});
vi.mock("@/lib/auth/session", () => ({ getCurrentSessionUser: vi.fn() }));

import { prisma } from "@/lib/db/prisma";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { startTest, submitTest, listTests, getTest, getWeakTopics } from "@/lib/assessments/testService";

const sessionUser = { id: "u1", email: "s@example.test", emailVerified: new Date() };
const profile = { id: "p1", userId: "u1", timezone: "UTC" };
const subject = { id: "sub1", studentProfileId: "p1", name: "Math" };

describe("startTest", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fails honestly when the subject has no questions yet", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.subject.findUnique as any).mockResolvedValue(subject);
    (prisma.question.findMany as any).mockResolvedValue([]);
    const result = await startTest("sub1", 10);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/question/i);
    expect(prisma.test.create).not.toHaveBeenCalled();
    expect(prisma.testAnswer.createMany).not.toHaveBeenCalled();
  });

  it("rejects a subject the caller does not own", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.subject.findUnique as any).mockResolvedValue({ id: "sub1", studentProfileId: "SOMEONE-ELSE" });
    const result = await startTest("sub1", 10);
    expect(result.success).toBe(false);
    expect(prisma.test.create).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated caller", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(null);
    const result = await startTest("sub1", 10);
    expect(result.success).toBe(false);
    expect(prisma.test.create).not.toHaveBeenCalled();
  });

  it("snapshots each picked question's content onto its TestAnswer at creation time", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.subject.findUnique as any).mockResolvedValue(subject);
    (prisma.question.findMany as any).mockResolvedValue([
      {
        id: "q1", studentProfileId: "p1", subjectId: "sub1", topic: "Fractions", type: "mcq",
        prompt: "1/2+1/4?", options: JSON.stringify(["3/4", "2/6"]), correctAnswer: "3/4",
      },
    ]);
    (prisma.test.create as any).mockResolvedValue({ id: "t1" });
    (prisma.testAnswer.createMany as any).mockResolvedValue({ count: 1 });

    const result = await startTest("sub1", 10);

    expect(result.success).toBe(true);
    expect(result.testId).toBe("t1");
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.test.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ studentProfileId: "p1", subjectId: "sub1" }) }),
    );
    expect(prisma.testAnswer.createMany).toHaveBeenCalledWith({
      data: [
        {
          testId: "t1", questionId: "q1", order: 0,
          promptSnapshot: "1/2+1/4?", optionsSnapshot: JSON.stringify(["3/4", "2/6"]),
          correctAnswerSnapshot: "3/4", topicSnapshot: "Fractions", typeSnapshot: "mcq",
        },
      ],
    });
  });
});

describe("submitTest", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects submitting a test that is already completed", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.test.findUnique as any).mockResolvedValue({
      id: "t1", studentProfileId: "p1", status: "completed", answers: [],
    });
    const result = await submitTest("t1", []);
    expect(result.success).toBe(false);
    expect(prisma.test.update).not.toHaveBeenCalled();
    expect(prisma.testAnswer.update).not.toHaveBeenCalled();
  });

  it("rejects a test owned by a different student without grading anything", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.test.findUnique as any).mockResolvedValue({
      id: "t1", studentProfileId: "SOMEONE-ELSE", status: "in_progress",
      answers: [{ id: "a1", testId: "t1", typeSnapshot: "mcq", correctAnswerSnapshot: "3/4" }],
    });
    const result = await submitTest("t1", [{ testAnswerId: "a1", answerGiven: "3/4" }]);
    expect(result.success).toBe(false);
    expect(prisma.testAnswer.update).not.toHaveBeenCalled();
    expect(prisma.test.update).not.toHaveBeenCalled();
  });

  it("rejects a testAnswerId that does not belong to the test being submitted", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.test.findUnique as any).mockResolvedValue({
      id: "t1", studentProfileId: "p1", status: "in_progress",
      answers: [{ id: "a1", testId: "t1", typeSnapshot: "mcq", correctAnswerSnapshot: "3/4" }],
    });
    const result = await submitTest("t1", [{ testAnswerId: "FOREIGN-ANSWER-ID", answerGiven: "3/4" }]);
    expect(result.success).toBe(false);
    expect(prisma.testAnswer.update).not.toHaveBeenCalled();
    expect(prisma.test.update).not.toHaveBeenCalled();
  });

  it("rejects the whole submission when only one of several ids is foreign", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.test.findUnique as any).mockResolvedValue({
      id: "t1", studentProfileId: "p1", status: "in_progress",
      answers: [{ id: "a1", testId: "t1", typeSnapshot: "mcq", correctAnswerSnapshot: "3/4" }],
    });
    const result = await submitTest("t1", [
      { testAnswerId: "a1", answerGiven: "3/4" },
      { testAnswerId: "FOREIGN-ANSWER-ID", answerGiven: "3/4" },
    ]);
    expect(result.success).toBe(false);
    expect(prisma.testAnswer.update).not.toHaveBeenCalled();
    expect(prisma.test.update).not.toHaveBeenCalled();
  });

  it("grades every answer, computes the score, and marks the test completed", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.test.findUnique as any).mockResolvedValue({
      id: "t1", studentProfileId: "p1", status: "in_progress",
      answers: [
        { id: "a1", testId: "t1", typeSnapshot: "mcq", correctAnswerSnapshot: "3/4" },
        { id: "a2", testId: "t1", typeSnapshot: "short_answer", correctAnswerSnapshot: "Paris" },
      ],
    });
    const result = await submitTest("t1", [
      { testAnswerId: "a1", answerGiven: "3/4" },
      { testAnswerId: "a2", answerGiven: "london" },
    ]);
    expect(result.success).toBe(true);
    expect(result.scorePercent).toBe(50);
    expect(prisma.testAnswer.update).toHaveBeenCalledWith({
      where: { id: "a1" }, data: { answerGiven: "3/4", isCorrect: true },
    });
    expect(prisma.testAnswer.update).toHaveBeenCalledWith({
      where: { id: "a2" }, data: { answerGiven: "london", isCorrect: false },
    });
    expect(prisma.test.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "t1" }, data: expect.objectContaining({ status: "completed", scorePercent: 50 }) }),
    );
  });

  it("grades a question left unanswered as incorrect", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.test.findUnique as any).mockResolvedValue({
      id: "t1", studentProfileId: "p1", status: "in_progress",
      answers: [
        { id: "a1", testId: "t1", typeSnapshot: "mcq", correctAnswerSnapshot: "3/4" },
        { id: "a2", testId: "t1", typeSnapshot: "short_answer", correctAnswerSnapshot: "Paris" },
      ],
    });
    const result = await submitTest("t1", [{ testAnswerId: "a1", answerGiven: "3/4" }]);
    expect(result.scorePercent).toBe(50);
    expect(prisma.testAnswer.update).toHaveBeenCalledWith({
      where: { id: "a2" }, data: { answerGiven: null, isCorrect: false },
    });
  });

  it("grades against the TestAnswer snapshot, never re-reading the live Question row", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    // The source question was edited after this test was generated: its live
    // correctAnswer is now "WRONG-NOW", but the snapshot still says "3/4".
    (prisma.test.findUnique as any).mockResolvedValue({
      id: "t1", studentProfileId: "p1", status: "in_progress",
      answers: [
        { id: "a1", testId: "t1", questionId: "q1", typeSnapshot: "mcq", correctAnswerSnapshot: "3/4" },
      ],
    });
    const result = await submitTest("t1", [{ testAnswerId: "a1", answerGiven: "3/4" }]);
    expect(result.scorePercent).toBe(100);
    expect(prisma.question.findMany).not.toHaveBeenCalled();
  });
});

describe("getWeakTopics", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an empty list with no session", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(null);
    expect(await getWeakTopics()).toEqual([]);
  });

  it("aggregates graded snapshot topics scoped to the caller's own profile", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.testAnswer.findMany as any).mockResolvedValue([
      { topicSnapshot: "Fractions", isCorrect: false },
      { topicSnapshot: "Fractions", isCorrect: false },
      { topicSnapshot: "Algebra", isCorrect: true },
      { topicSnapshot: "Algebra", isCorrect: false },
    ]);

    const result = await getWeakTopics();

    expect(prisma.testAnswer.findMany).toHaveBeenCalledWith({
      where: { isCorrect: { not: null }, test: { studentProfileId: "p1" } },
    });
    expect(result[0]).toEqual({ topic: "Fractions", attempts: 2, wrongRate: 100 });
    expect(result[1]).toEqual({ topic: "Algebra", attempts: 2, wrongRate: 50 });
  });
});

describe("listTests / getTest -- cross-student protection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getTest returns null for a test owned by a different student", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.test.findUnique as any).mockResolvedValue({ id: "t1", studentProfileId: "SOMEONE-ELSE", answers: [] });
    expect(await getTest("t1")).toBeNull();
  });

  it("getTest decodes the snapshotted options back into an array", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.test.findUnique as any).mockResolvedValue({
      id: "t1", studentProfileId: "p1", subjectId: "sub1", status: "in_progress",
      scorePercent: null, createdAt: new Date("2026-10-01"), completedAt: null,
      subject: { id: "sub1", name: "Math" },
      answers: [
        {
          id: "a1", order: 0, typeSnapshot: "mcq", promptSnapshot: "1/2+1/4?",
          optionsSnapshot: JSON.stringify(["3/4", "2/6"]), correctAnswerSnapshot: "3/4",
          topicSnapshot: "Fractions", answerGiven: null, isCorrect: null,
        },
      ],
    });

    const result = await getTest("t1");

    expect(result?.subjectName).toBe("Math");
    expect(result?.answers[0].options).toEqual(["3/4", "2/6"]);
    expect(result?.answers[0].type).toBe("mcq");
  });

  it("listTests returns an empty list with no session", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(null);
    expect(await listTests()).toEqual([]);
  });

  it("listTests scopes to the caller's own profile and orders newest first", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.test.findMany as any).mockResolvedValue([
      {
        id: "t2", subjectId: "sub1", status: "completed", scorePercent: 80,
        createdAt: new Date("2026-10-02"), completedAt: new Date("2026-10-02"),
        subject: { id: "sub1", name: "Math" },
      },
    ]);

    const result = await listTests();

    expect(prisma.test.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentProfileId: "p1" },
        orderBy: { createdAt: "desc" },
      }),
    );
    expect(result[0]).toEqual({
      id: "t2", subjectId: "sub1", subjectName: "Math", status: "completed",
      scorePercent: 80, createdAt: new Date("2026-10-02"), completedAt: new Date("2026-10-02"),
    });
  });
});
