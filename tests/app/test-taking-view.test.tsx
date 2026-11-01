import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TestTakingView } from "@/app/(app)/tests/[id]/TestTakingView";

vi.mock("@/lib/assessments/testService", () => ({ submitTest: vi.fn() }));
import { submitTest } from "@/lib/assessments/testService";

const inProgressTest = {
  id: "t1",
  subjectId: "sub1",
  subjectName: "Math",
  status: "in_progress" as const,
  scorePercent: null,
  createdAt: new Date(),
  completedAt: null,
  answers: [
    {
      id: "a1",
      order: 0,
      type: "mcq" as const,
      prompt: "1/2+1/4?",
      options: ["3/4", "2/6"],
      correctAnswer: "3/4",
      topic: "Fractions",
      answerGiven: null,
      isCorrect: null,
    },
    {
      id: "a2",
      order: 1,
      type: "short_answer" as const,
      prompt: "Capital of France?",
      options: [],
      correctAnswer: "Paris",
      topic: "Geography",
      answerGiven: null,
      isCorrect: null,
    },
  ],
};

const completedTest = {
  ...inProgressTest,
  status: "completed" as const,
  scorePercent: 100,
  completedAt: new Date(),
  answers: [
    { ...inProgressTest.answers[0], answerGiven: "3/4", isCorrect: true },
    { ...inProgressTest.answers[1], answerGiven: "Paris", isCorrect: true },
  ],
};

describe("TestTakingView", () => {
  it("lets the student pick an mcq answer, fill a short answer, and submit", async () => {
    (submitTest as any).mockResolvedValue({ success: true, scorePercent: 100 });
    render(<TestTakingView test={inProgressTest} />);

    fireEvent.click(screen.getByLabelText("3/4"));
    fireEvent.change(screen.getByLabelText(/capital of france/i), { target: { value: "Paris" } });
    fireEvent.click(screen.getByRole("button", { name: /submit test/i }));

    await waitFor(() => {
      expect(submitTest).toHaveBeenCalledWith("t1", [
        { testAnswerId: "a1", answerGiven: "3/4" },
        { testAnswerId: "a2", answerGiven: "Paris" },
      ]);
    });
  });

  it("shows a read-only review with the score for a completed test", () => {
    render(<TestTakingView test={completedTest} />);
    expect(screen.getByText(/100/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /submit test/i })).not.toBeInTheDocument();
  });

  it("surfaces an error instead of completing the view when submission fails", async () => {
    (submitTest as any).mockResolvedValue({ success: false, error: "This test has already been submitted." });
    render(<TestTakingView test={inProgressTest} />);

    fireEvent.click(screen.getByRole("button", { name: /submit test/i }));

    await waitFor(() => {
      expect(screen.getByText(/already been submitted/i)).toBeInTheDocument();
    });
  });
});
