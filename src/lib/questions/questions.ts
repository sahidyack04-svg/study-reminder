"use server";

import { prisma } from "@/lib/db/prisma";
import { getCurrentSessionUser } from "@/lib/auth/session";

export interface QuestionView {
  id: string;
  subjectId: string;
  topic: string;
  type: "mcq" | "short_answer";
  prompt: string;
  options: string[];
  correctAnswer: string;
}

export interface QuestionInput {
  subjectId: string;
  topic: string;
  type: "mcq" | "short_answer";
  prompt: string;
  options: string[]; // ignored/empty for "short_answer"
  correctAnswer: string;
}

// Shape of the Prisma `Question` row fields this module reads. Declared
// locally (rather than importing the generated type) so the mapping below
// stays readable and the module has no compile-time coupling to anything
// Task 4 adds to the model.
interface QuestionRow {
  id: string;
  subjectId: string;
  topic: string;
  type: string;
  prompt: string;
  options: string;
  correctAnswer: string;
}

// `options` is stored JSON-encoded (`Question.options: String`). Anything that
// isn't a JSON array of strings decodes to `[]` rather than throwing -- a
// short-answer row legitimately has no options.
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

function toQuestionView(row: QuestionRow): QuestionView {
  return {
    id: row.id,
    subjectId: row.subjectId,
    topic: row.topic,
    type: row.type === "mcq" ? "mcq" : "short_answer",
    prompt: row.prompt,
    options: decodeOptions(row.options),
    correctAnswer: row.correctAnswer,
  };
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

async function assertOwnedQuestion(questionId: string, profileId: string) {
  const question = await prisma.question.findUnique({ where: { id: questionId } });
  if (!question || question.studentProfileId !== profileId) {
    return null;
  }
  return question;
}

// Shared validation for create and update. Returns the normalized fields ready
// to write, or an error message -- never both.
function normalizeInput(
  input: QuestionInput,
): { error: string } | { data: { topic: string; type: string; prompt: string; options: string; correctAnswer: string } } {
  const prompt = input.prompt.trim();
  if (!prompt) {
    return { error: "Prompt is required." };
  }
  const topic = input.topic.trim();
  if (!topic) {
    return { error: "Topic is required." };
  }
  const correctAnswer = input.correctAnswer.trim();
  if (!correctAnswer) {
    return { error: "A correct answer is required." };
  }

  // Short-answer questions have no options at all; MCQ needs at least two
  // distinct choices, one of which must be the correct answer verbatim.
  const options =
    input.type === "mcq" ? input.options.map((option) => option.trim()).filter(Boolean) : [];

  if (input.type === "mcq") {
    if (options.length < 2) {
      return { error: "A multiple-choice question needs at least two options." };
    }
    if (!options.includes(correctAnswer)) {
      return { error: "The correct answer must be one of the options." };
    }
  }

  return {
    data: {
      topic,
      type: input.type,
      prompt,
      options: JSON.stringify(options),
      correctAnswer,
    },
  };
}

export async function listQuestions(subjectId: string): Promise<QuestionView[]> {
  const profile = await getOwnProfile();
  if (!profile) return [];
  const rows = await prisma.question.findMany({
    where: { studentProfileId: profile.id, subjectId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toQuestionView);
}

export async function createQuestion(
  input: QuestionInput,
): Promise<{ success: boolean; error?: string; question?: QuestionView }> {
  const profile = await getOwnProfile();
  if (!profile) {
    return { success: false, error: "You must be signed in to add a question." };
  }

  const normalized = normalizeInput(input);
  if ("error" in normalized) {
    return { success: false, error: normalized.error };
  }

  if (!(await assertOwnedSubject(input.subjectId, profile.id))) {
    return { success: false, error: "Subject not found." };
  }

  const question = await prisma.question.create({
    data: {
      studentProfileId: profile.id,
      subjectId: input.subjectId,
      ...normalized.data,
    },
  });
  return { success: true, question: toQuestionView(question) };
}

export async function updateQuestion(
  questionId: string,
  input: QuestionInput,
): Promise<{ success: boolean; error?: string }> {
  const profile = await getOwnProfile();
  if (!profile) {
    return { success: false, error: "You must be signed in to update a question." };
  }

  // Generic failure whether the row belongs to someone else or doesn't exist.
  const question = await assertOwnedQuestion(questionId, profile.id);
  if (!question) {
    return { success: false, error: "Question not found." };
  }

  const normalized = normalizeInput(input);
  if ("error" in normalized) {
    return { success: false, error: normalized.error };
  }

  if (!(await assertOwnedSubject(input.subjectId, profile.id))) {
    return { success: false, error: "Subject not found." };
  }

  await prisma.question.update({
    where: { id: questionId },
    data: { subjectId: input.subjectId, ...normalized.data },
  });
  return { success: true };
}

export async function deleteQuestion(
  questionId: string,
): Promise<{ success: boolean; error?: string }> {
  const profile = await getOwnProfile();
  if (!profile) {
    return { success: false, error: "You must be signed in to delete a question." };
  }

  const question = await assertOwnedQuestion(questionId, profile.id);
  if (!question) {
    return { success: false, error: "Question not found." };
  }

  await prisma.question.delete({ where: { id: questionId } });
  return { success: true };
}
