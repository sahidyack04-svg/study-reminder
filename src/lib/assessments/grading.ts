export type QuestionType = "mcq" | "short_answer";

export interface GradableAnswer {
  type: QuestionType;
  correctAnswer: string;
  answerGiven: string | null;
}

/**
 * Grades a single answer. An unanswered question is always incorrect.
 * `mcq` is an exact string match; `short_answer` is trimmed and
 * case-insensitive. No fuzzy or AI grading.
 */
export function gradeAnswer(answer: GradableAnswer): boolean {
  if (answer.answerGiven === null) return false;
  if (answer.type === "mcq") return answer.answerGiven === answer.correctAnswer;
  return answer.answerGiven.trim().toLowerCase() === answer.correctAnswer.trim().toLowerCase();
}

/** Percentage of correct results, 0-100, rounded. An empty set scores 0, never NaN. */
export function computeScorePercent(results: boolean[]): number {
  if (results.length === 0) return 0;
  const correct = results.filter(Boolean).length;
  return Math.round((correct / results.length) * 100);
}
