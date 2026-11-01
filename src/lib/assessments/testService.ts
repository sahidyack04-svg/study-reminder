"use server";

import { prisma } from "@/lib/db/prisma";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { gradeAnswer } from "./grading";
import { computeScorePercent } from "./grading";
import { computeWeakTopics } from "./weakTopics";
import type { WeakTopic } from "./weakTopics";
import { pickRandomQuestions } from "./selectQuestions";

export interface TestSummary {
  id: string;
  subjectId: string;
  subjectName: string;
  status: "in_progress" | "completed";
  scorePercent: number | null;
  createdAt: Date;
  completedAt: Date | null;
}

export interface TestAnswerView {
  id: string;
  order: number;
  type: "mcq" | "short_answer";
  prompt: string;
  options: string[];
  correctAnswer: string;
  topic: string;
  answerGiven: string | null;
  isCorrect: boolean | null;
}

export interface TestDetail extends TestSummary {
  answers: TestAnswerView[];
}

async function getOwnProfile() {
  const user = await getCurrentSessionUser();
  if (!user) return null;
  return prisma.studentProfile.findUnique({ where: { userId: user.id } });
}

async function assertOwnedSubject(subjectId: string, profileId: string): Promise<boolean> {
  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  return !!subject && subject.studentProfileId === profileId;
}

// `options`/`optionsSnapshot` are stored JSON-encoded. Anything that isn't a
// JSON array of strings decodes to `[]` rather than throwing.
function decodeOptions(encoded: string): string[] {
  if (!encoded) return [];
  try {
    const parsed = JSON.parse(encoded);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((option): option is string => typeof option === "string");
  } catch {
    return [];
  }
}

function toTestSummary(row: {
  id: string;
  subjectId: string;
  subject: { name: string };
  status: string;
  scorePercent: number | null;
  createdAt: Date;
  completedAt: Date | null;
}): TestSummary {
  return {
    id: row.id,
    subjectId: row.subjectId,
    subjectName: row.subject.name,
    status: row.status === "completed" ? "completed" : "in_progress",
    scorePercent: row.scorePercent,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  };
}

function toTestAnswerView(row: {
  id: string;
  order: number;
  typeSnapshot: string;
  promptSnapshot: string;
  optionsSnapshot: string;
  correctAnswerSnapshot: string;
  topicSnapshot: string;
  answerGiven: string | null;
  isCorrect: boolean | null;
}): TestAnswerView {
  return {
    id: row.id,
    order: row.order,
    type: row.typeSnapshot === "mcq" ? "mcq" : "short_answer",
    prompt: row.promptSnapshot,
    options: decodeOptions(row.optionsSnapshot),
    correctAnswer: row.correctAnswerSnapshot,
    topic: row.topicSnapshot,
    answerGiven: row.answerGiven,
    isCorrect: row.isCorrect,
  };
}

export async function listTests(): Promise<TestSummary[]> {
  const profile = await getOwnProfile();
  if (!profile) return [];

  const rows = await prisma.test.findMany({
    where: { studentProfileId: profile.id },
    include: { subject: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toTestSummary);
}

export async function getTest(testId: string): Promise<TestDetail | null> {
  const profile = await getOwnProfile();
  if (!profile) return null;

  const row = await prisma.test.findUnique({
    where: { id: testId },
    include: { subject: true, answers: { orderBy: { order: "asc" } } },
  });
  if (!row || row.studentProfileId !== profile.id) return null;

  return {
    ...toTestSummary(row),
    answers: row.answers.map(toTestAnswerView),
  };
}

export async function startTest(
  subjectId: string,
  questionCount: number,
): Promise<{ success: boolean; error?: string; testId?: string }> {
  const profile = await getOwnProfile();
  if (!profile) {
    return { success: false, error: "You must be signed in to start a test." };
  }

  if (!(await assertOwnedSubject(subjectId, profile.id))) {
    return { success: false, error: "Subject not found." };
  }

  const questions = await prisma.question.findMany({
    where: { studentProfileId: profile.id, subjectId },
  });
  if (questions.length === 0) {
    return { success: false, error: "This subject has no questions yet. Add some in the question bank first." };
  }

  const picked = pickRandomQuestions(questions, questionCount);

  const testId = await prisma.$transaction(async (tx) => {
    const test = await tx.test.create({
      data: { studentProfileId: profile.id, subjectId },
    });
    await tx.testAnswer.createMany({
      data: picked.map((question, index) => ({
        testId: test.id,
        questionId: question.id,
        order: index,
        promptSnapshot: question.prompt,
        optionsSnapshot: question.options,
        correctAnswerSnapshot: question.correctAnswer,
        topicSnapshot: question.topic,
        typeSnapshot: question.type,
      })),
    });
    return test.id;
  });

  return { success: true, testId };
}

export async function submitTest(
  testId: string,
  answers: { testAnswerId: string; answerGiven: string }[],
): Promise<{ success: boolean; error?: string; scorePercent?: number }> {
  const profile = await getOwnProfile();
  if (!profile) {
    return { success: false, error: "You must be signed in to submit a test." };
  }

  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: { answers: true },
  });
  if (!test || test.studentProfileId !== profile.id) {
    return { success: false, error: "Test not found." };
  }
  if (test.status === "completed") {
    return { success: false, error: "This test has already been submitted." };
  }

  const answerById = new Map(test.answers.map((a) => [a.id, a]));
  const submittedById = new Map(answers.map((a) => [a.testAnswerId, a.answerGiven]));
  for (const submitted of answers) {
    if (!answerById.has(submitted.testAnswerId)) {
      return { success: false, error: "Invalid answer submitted." };
    }
  }

  const graded = test.answers.map((answer) => {
    const answerGiven = submittedById.has(answer.id) ? submittedById.get(answer.id)! : null;
    const isCorrect = gradeAnswer({
      type: answer.typeSnapshot === "mcq" ? "mcq" : "short_answer",
      correctAnswer: answer.correctAnswerSnapshot,
      answerGiven,
    });
    return { id: answer.id, answerGiven, isCorrect };
  });
  const scorePercent = computeScorePercent(graded.map((g) => g.isCorrect));

  await prisma.$transaction(async (tx) => {
    for (const result of graded) {
      await tx.testAnswer.update({
        where: { id: result.id },
        data: { answerGiven: result.answerGiven, isCorrect: result.isCorrect },
      });
    }
    await tx.test.update({
      where: { id: testId },
      data: { status: "completed", completedAt: new Date(), scorePercent },
    });
  });

  return { success: true, scorePercent };
}

export async function getWeakTopics(): Promise<WeakTopic[]> {
  const profile = await getOwnProfile();
  if (!profile) return [];

  const rows = await prisma.testAnswer.findMany({
    where: { isCorrect: { not: null }, test: { studentProfileId: profile.id } },
  });
  return computeWeakTopics(
    rows.map((row) => ({ topic: row.topicSnapshot, isCorrect: row.isCorrect as boolean })),
  );
}
