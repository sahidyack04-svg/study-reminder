import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QuestionBankView } from "@/app/(app)/questions/QuestionBankView";

vi.mock("@/lib/questions/questions", () => ({
  createQuestion: vi.fn(),
  updateQuestion: vi.fn(),
  deleteQuestion: vi.fn(),
}));

import { createQuestion, deleteQuestion } from "@/lib/questions/questions";

const subjects = [{ id: "sub1", name: "Math" }];
const initialQuestions = {
  sub1: [
    {
      id: "q1",
      subjectId: "sub1",
      topic: "Fractions",
      type: "mcq" as const,
      prompt: "1/2+1/4?",
      options: ["3/4", "2/6"],
      correctAnswer: "3/4",
    },
  ],
};

describe("QuestionBankView", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows an empty-bank message for a subject with no questions", () => {
    render(<QuestionBankView subjects={[{ id: "sub2", name: "Science" }]} initialQuestions={{ sub2: [] }} />);
    expect(screen.getByText(/no questions yet/i)).toBeInTheDocument();
  });

  it("adds a new question to the list on successful submit", async () => {
    (createQuestion as any).mockResolvedValue({
      success: true,
      question: {
        id: "q2",
        subjectId: "sub1",
        topic: "Decimals",
        type: "short_answer",
        prompt: "0.5 as a fraction?",
        options: [],
        correctAnswer: "1/2",
      },
    });
    render(<QuestionBankView subjects={subjects} initialQuestions={initialQuestions} />);

    fireEvent.change(screen.getByLabelText(/prompt/i), { target: { value: "0.5 as a fraction?" } });
    fireEvent.click(screen.getByRole("button", { name: /add question/i }));

    await waitFor(() => {
      expect(screen.getByText("0.5 as a fraction?")).toBeInTheDocument();
    });
  });

  it("surfaces an error when adding a question fails", async () => {
    (createQuestion as any).mockResolvedValue({ success: false, error: "Prompt is required." });
    render(<QuestionBankView subjects={subjects} initialQuestions={initialQuestions} />);

    fireEvent.change(screen.getByLabelText(/prompt/i), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: /add question/i }));

    await waitFor(() => {
      expect(screen.getByText("Prompt is required.")).toBeInTheDocument();
    });
  });

  it("removes a question from the list after a successful delete", async () => {
    (deleteQuestion as any).mockResolvedValue({ success: true });
    render(<QuestionBankView subjects={subjects} initialQuestions={initialQuestions} />);

    fireEvent.click(screen.getByRole("button", { name: /delete/i }));

    await waitFor(() => {
      expect(screen.queryByText("1/2+1/4?")).not.toBeInTheDocument();
    });
  });

  it("surfaces an error and keeps the question when deleting fails", async () => {
    (deleteQuestion as any).mockResolvedValue({ success: false, error: "Question not found." });
    render(<QuestionBankView subjects={subjects} initialQuestions={initialQuestions} />);

    fireEvent.click(screen.getByRole("button", { name: /delete/i }));

    await waitFor(() => {
      expect(screen.getByText("Question not found.")).toBeInTheDocument();
    });
    expect(screen.getByText("1/2+1/4?")).toBeInTheDocument();
  });
});
