import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    studentProfile: { findUnique: vi.fn() },
    subject: { findUnique: vi.fn() },
    question: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));
vi.mock("@/lib/auth/session", () => ({ getCurrentSessionUser: vi.fn() }));

import { prisma } from "@/lib/db/prisma";
import { getCurrentSessionUser } from "@/lib/auth/session";
import {
  listQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
} from "@/lib/questions/questions";

const sessionUser = { id: "u1", email: "s@example.test", emailVerified: new Date() };
const profile = { id: "p1", userId: "u1", timezone: "UTC" };
const subject = { id: "sub1", studentProfileId: "p1", name: "Math", order: 0 };

describe("listQuestions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an empty list with no session", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(null);
    expect(await listQuestions("sub1")).toEqual([]);
  });

  it("decodes the JSON-encoded options field back into an array", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.question.findMany as any).mockResolvedValue([
      {
        id: "q1",
        subjectId: "sub1",
        topic: "Fractions",
        type: "mcq",
        prompt: "1/2+1/4?",
        options: JSON.stringify(["3/4", "2/6"]),
        correctAnswer: "3/4",
      },
    ]);
    const result = await listQuestions("sub1");
    expect(result[0].options).toEqual(["3/4", "2/6"]);
  });

  it("scopes the query to the caller's own profile", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.question.findMany as any).mockResolvedValue([]);
    await listQuestions("sub1");
    expect(prisma.question.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ studentProfileId: "p1", subjectId: "sub1" }),
      }),
    );
  });

  it("returns an empty options array for a short-answer question", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.question.findMany as any).mockResolvedValue([
      {
        id: "q2",
        subjectId: "sub1",
        topic: "Fractions",
        type: "short_answer",
        prompt: "Name the top number of a fraction.",
        options: "",
        correctAnswer: "numerator",
      },
    ]);
    const result = await listQuestions("sub1");
    expect(result[0].options).toEqual([]);
  });
});

describe("createQuestion", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects an empty prompt without touching the database", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    const result = await createQuestion({
      subjectId: "sub1",
      topic: "Fractions",
      type: "mcq",
      prompt: "  ",
      options: ["a", "b"],
      correctAnswer: "a",
    });
    expect(result.success).toBe(false);
    expect(prisma.question.create).not.toHaveBeenCalled();
  });

  it("rejects a subject the caller does not own", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.subject.findUnique as any).mockResolvedValue({
      id: "sub1",
      studentProfileId: "SOMEONE-ELSE",
    });
    const result = await createQuestion({
      subjectId: "sub1",
      topic: "Fractions",
      type: "mcq",
      prompt: "1/2+1/4?",
      options: ["3/4", "2/6"],
      correctAnswer: "3/4",
    });
    expect(result.success).toBe(false);
    expect(prisma.question.create).not.toHaveBeenCalled();
  });

  it("JSON-encodes options before writing, and scopes the row to the caller's own profile", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.subject.findUnique as any).mockResolvedValue(subject);
    (prisma.question.create as any).mockResolvedValue({ id: "q1" });
    await createQuestion({
      subjectId: "sub1",
      topic: "Fractions",
      type: "mcq",
      prompt: "1/2+1/4?",
      options: ["3/4", "2/6"],
      correctAnswer: "3/4",
    });
    expect(prisma.question.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          studentProfileId: "p1",
          options: JSON.stringify(["3/4", "2/6"]),
        }),
      }),
    );
  });

  it("returns the created question with options decoded back into an array", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.subject.findUnique as any).mockResolvedValue(subject);
    (prisma.question.create as any).mockResolvedValue({
      id: "q1",
      subjectId: "sub1",
      topic: "Fractions",
      type: "mcq",
      prompt: "1/2+1/4?",
      options: JSON.stringify(["3/4", "2/6"]),
      correctAnswer: "3/4",
    });
    const result = await createQuestion({
      subjectId: "sub1",
      topic: "Fractions",
      type: "mcq",
      prompt: "1/2+1/4?",
      options: ["3/4", "2/6"],
      correctAnswer: "3/4",
    });
    expect(result.success).toBe(true);
    expect(result.question?.options).toEqual(["3/4", "2/6"]);
  });

  it("rejects an mcq whose correct answer is not one of its options", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.subject.findUnique as any).mockResolvedValue(subject);
    const result = await createQuestion({
      subjectId: "sub1",
      topic: "Fractions",
      type: "mcq",
      prompt: "1/2+1/4?",
      options: ["3/4", "2/6"],
      correctAnswer: "5/8",
    });
    expect(result.success).toBe(false);
    expect(prisma.question.create).not.toHaveBeenCalled();
  });

  it("rejects an mcq with fewer than two options", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.subject.findUnique as any).mockResolvedValue(subject);
    const result = await createQuestion({
      subjectId: "sub1",
      topic: "Fractions",
      type: "mcq",
      prompt: "1/2+1/4?",
      options: ["3/4"],
      correctAnswer: "3/4",
    });
    expect(result.success).toBe(false);
    expect(prisma.question.create).not.toHaveBeenCalled();
  });

  it("rejects an empty correct answer", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.subject.findUnique as any).mockResolvedValue(subject);
    const result = await createQuestion({
      subjectId: "sub1",
      topic: "Fractions",
      type: "short_answer",
      prompt: "Top number of a fraction?",
      options: [],
      correctAnswer: "   ",
    });
    expect(result.success).toBe(false);
    expect(prisma.question.create).not.toHaveBeenCalled();
  });

  it("rejects an empty topic", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.subject.findUnique as any).mockResolvedValue(subject);
    const result = await createQuestion({
      subjectId: "sub1",
      topic: " ",
      type: "short_answer",
      prompt: "Top number of a fraction?",
      options: [],
      correctAnswer: "numerator",
    });
    expect(result.success).toBe(false);
    expect(prisma.question.create).not.toHaveBeenCalled();
  });

  it("requires a session to create", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(null);
    const result = await createQuestion({
      subjectId: "sub1",
      topic: "Fractions",
      type: "mcq",
      prompt: "1/2+1/4?",
      options: ["3/4", "2/6"],
      correctAnswer: "3/4",
    });
    expect(result.success).toBe(false);
    expect(prisma.question.create).not.toHaveBeenCalled();
  });

  it("stores an empty options array for a short-answer question", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.subject.findUnique as any).mockResolvedValue(subject);
    (prisma.question.create as any).mockResolvedValue({
      id: "q2",
      subjectId: "sub1",
      topic: "Fractions",
      type: "short_answer",
      prompt: "Top number of a fraction?",
      options: JSON.stringify([]),
      correctAnswer: "numerator",
    });
    await createQuestion({
      subjectId: "sub1",
      topic: "Fractions",
      type: "short_answer",
      prompt: "Top number of a fraction?",
      options: ["ignored"],
      correctAnswer: "numerator",
    });
    expect(prisma.question.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ options: JSON.stringify([]) }),
      }),
    );
  });
});

describe("updateQuestion / deleteQuestion -- cross-student protection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updateQuestion refuses to touch a question owned by a different student", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.question.findUnique as any).mockResolvedValue({
      id: "q1",
      studentProfileId: "SOMEONE-ELSE",
    });
    const result = await updateQuestion("q1", {
      subjectId: "sub1",
      topic: "Fractions",
      type: "mcq",
      prompt: "x",
      options: ["a", "b"],
      correctAnswer: "a",
    });
    expect(result.success).toBe(false);
    expect(prisma.question.update).not.toHaveBeenCalled();
  });

  it("deleteQuestion refuses to touch a question owned by a different student", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.question.findUnique as any).mockResolvedValue({
      id: "q1",
      studentProfileId: "SOMEONE-ELSE",
    });
    const result = await deleteQuestion("q1");
    expect(result.success).toBe(false);
    expect(prisma.question.delete).not.toHaveBeenCalled();
  });

  it("updateQuestion gives the same generic error for a question that does not exist at all", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.question.findUnique as any).mockResolvedValue({
      id: "q1",
      studentProfileId: "SOMEONE-ELSE",
    });
    const foreign = await updateQuestion("q1", {
      subjectId: "sub1",
      topic: "Fractions",
      type: "mcq",
      prompt: "x",
      options: ["a", "b"],
      correctAnswer: "a",
    });
    (prisma.question.findUnique as any).mockResolvedValue(null);
    const missing = await updateQuestion("q1", {
      subjectId: "sub1",
      topic: "Fractions",
      type: "mcq",
      prompt: "x",
      options: ["a", "b"],
      correctAnswer: "a",
    });
    expect(missing.error).toBe(foreign.error);
    expect(prisma.question.update).not.toHaveBeenCalled();
  });
});

describe("updateQuestion / deleteQuestion -- happy path", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updateQuestion JSON-encodes options and writes only to the owned row", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.question.findUnique as any).mockResolvedValue({
      id: "q1",
      studentProfileId: "p1",
      subjectId: "sub1",
    });
    (prisma.subject.findUnique as any).mockResolvedValue(subject);
    (prisma.question.update as any).mockResolvedValue({ id: "q1" });
    const result = await updateQuestion("q1", {
      subjectId: "sub1",
      topic: "Decimals",
      type: "mcq",
      prompt: "0.5+0.25?",
      options: ["0.75", "0.3"],
      correctAnswer: "0.75",
    });
    expect(result.success).toBe(true);
    expect(prisma.question.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "q1" },
        data: expect.objectContaining({
          topic: "Decimals",
          options: JSON.stringify(["0.75", "0.3"]),
        }),
      }),
    );
  });

  it("deleteQuestion deletes an owned question", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.question.findUnique as any).mockResolvedValue({
      id: "q1",
      studentProfileId: "p1",
    });
    (prisma.question.delete as any).mockResolvedValue({ id: "q1" });
    const result = await deleteQuestion("q1");
    expect(result.success).toBe(true);
    expect(prisma.question.delete).toHaveBeenCalledWith({ where: { id: "q1" } });
  });

  it("requires a session to delete", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(null);
    const result = await deleteQuestion("q1");
    expect(result.success).toBe(false);
    expect(prisma.question.delete).not.toHaveBeenCalled();
  });
});
