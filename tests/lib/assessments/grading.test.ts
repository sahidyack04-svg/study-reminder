import { describe, it, expect } from "vitest";
import { gradeAnswer, computeScorePercent } from "@/lib/assessments/grading";

describe("gradeAnswer", () => {
  it("grades an mcq answer as correct only on an exact match", () => {
    expect(gradeAnswer({ type: "mcq", correctAnswer: "3/4", answerGiven: "3/4" })).toBe(true);
    expect(gradeAnswer({ type: "mcq", correctAnswer: "3/4", answerGiven: "2/6" })).toBe(false);
  });

  it("grades a short_answer case-insensitively and trimmed", () => {
    expect(gradeAnswer({ type: "short_answer", correctAnswer: "Paris", answerGiven: "  paris  " })).toBe(true);
    expect(gradeAnswer({ type: "short_answer", correctAnswer: "Paris", answerGiven: "London" })).toBe(false);
  });

  it("grades an unanswered question (null) as incorrect", () => {
    expect(gradeAnswer({ type: "mcq", correctAnswer: "3/4", answerGiven: null })).toBe(false);
    expect(gradeAnswer({ type: "short_answer", correctAnswer: "Paris", answerGiven: null })).toBe(false);
  });
});

describe("computeScorePercent", () => {
  it("rounds to the nearest whole percent", () => {
    expect(computeScorePercent([true, true, false])).toBe(67);
  });

  it("returns 0 for an empty result set, not NaN", () => {
    expect(computeScorePercent([])).toBe(0);
  });
});
