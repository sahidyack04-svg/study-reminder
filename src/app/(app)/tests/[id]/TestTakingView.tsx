"use client";

import { useState } from "react";
import { submitTest } from "@/lib/assessments/testService";
import type { TestDetail } from "@/lib/assessments/testService";

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40";

export function TestTakingView({ test: initialTest }: { test: TestDetail }) {
  const [test, setTest] = useState(initialTest);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (test.status === "completed") {
    return (
      <div className="flex animate-fade-up flex-col gap-6">
        <section className="panel-cosmic flex items-center justify-between gap-3 p-6">
          <h2 className="text-lg font-semibold text-ink">Score</h2>
          <p className="text-2xl font-semibold text-brand text-glow">{test.scorePercent}%</p>
        </section>
        <ul className="flex flex-col gap-3">
          {test.answers.map((answer) => (
            <li key={answer.id} className="panel-cosmic flex flex-col gap-1 p-4">
              <p className="text-sm font-medium text-ink">{answer.prompt}</p>
              <p className="text-xs text-ink-muted">{answer.topic}</p>
              <p className={`text-sm ${answer.isCorrect ? "text-success" : "text-danger"}`}>
                Your answer: {answer.answerGiven ?? "(no answer)"}
              </p>
              {!answer.isCorrect && (
                <p className="text-sm text-ink-muted">Correct answer: {answer.correctAnswer}</p>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const answers = test.answers.map((answer) => ({
      testAnswerId: answer.id,
      answerGiven: responses[answer.id] ?? "",
    }));
    const result = await submitTest(test.id, answers);
    setSubmitting(false);
    if (!result.success) {
      setError(result.error ?? "Something went wrong.");
      return;
    }
    setTest((prev) => ({
      ...prev,
      status: "completed",
      scorePercent: result.scorePercent ?? null,
      answers: prev.answers.map((answer) => ({
        ...answer,
        answerGiven: responses[answer.id] ?? null,
      })),
    }));
  }

  return (
    <form onSubmit={handleSubmit} className="flex animate-fade-up flex-col gap-4">
      {test.answers.map((answer) => (
        <section key={answer.id} className="panel-cosmic flex flex-col gap-3 p-6">
          <p className="text-xs text-ink-muted">{answer.topic}</p>
          {answer.type === "mcq" ? (
            <>
              <p className="text-sm font-medium text-ink">{answer.prompt}</p>
              <div className="flex flex-col gap-2">
                {answer.options.map((option) => (
                  <label key={option} className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="radio"
                      name={`answer-${answer.id}`}
                      aria-label={option}
                      checked={responses[answer.id] === option}
                      onChange={() => setResponses((prev) => ({ ...prev, [answer.id]: option }))}
                    />
                    {option}
                  </label>
                ))}
              </div>
            </>
          ) : (
            <label className="flex flex-col gap-1 text-sm font-medium text-ink">
              {answer.prompt}
              <input
                value={responses[answer.id] ?? ""}
                onChange={(e) => setResponses((prev) => ({ ...prev, [answer.id]: e.target.value }))}
                className={fieldClass}
              />
            </label>
          )}
        </section>
      ))}

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-lg bg-brand px-4 py-2 font-semibold text-cosmic-void shadow-glow transition hover:bg-brand-dark disabled:opacity-60"
      >
        {submitting ? "Submitting…" : "Submit test"}
      </button>
    </form>
  );
}
