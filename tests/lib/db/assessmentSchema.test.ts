import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db/prisma";

describe("Question/Test/TestAnswer schema", () => {
  it("creates a question, a test, and a snapshot answer scoped to a student profile", async () => {
    const user = await prisma.user.create({
      data: { email: `assess-${Date.now()}@example.test`, passwordHash: "x", emailVerified: new Date() },
    });
    const profile = await prisma.studentProfile.create({
      data: {
        userId: user.id, name: "Test Student", dateOfBirth: new Date("2010-01-01"),
        grade: "8", schoolName: "Test School", curriculum: "General", academicYear: "2026",
        timezone: "UTC",
      },
    });
    const subject = await prisma.subject.create({ data: { studentProfileId: profile.id, name: "Math" } });

    const question = await prisma.question.create({
      data: {
        studentProfileId: profile.id, subjectId: subject.id, topic: "Fractions",
        type: "mcq", prompt: "1/2 + 1/4 = ?", options: JSON.stringify(["3/4", "2/6"]), correctAnswer: "3/4",
      },
    });

    const test = await prisma.test.create({
      data: { studentProfileId: profile.id, subjectId: subject.id },
    });
    const answer = await prisma.testAnswer.create({
      data: {
        testId: test.id, questionId: question.id, order: 0,
        promptSnapshot: question.prompt, optionsSnapshot: question.options,
        correctAnswerSnapshot: question.correctAnswer, topicSnapshot: question.topic,
        typeSnapshot: question.type,
      },
    });

    expect(test.status).toBe("in_progress");
    expect(test.scorePercent).toBeNull();
    expect(answer.answerGiven).toBeNull();
    expect(answer.isCorrect).toBeNull();

    const refetchedTest = await prisma.test.findUnique({ where: { id: test.id }, include: { answers: true } });
    expect(refetchedTest?.answers).toHaveLength(1);
  });
});
