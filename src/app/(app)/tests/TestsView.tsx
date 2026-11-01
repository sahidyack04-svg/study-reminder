"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { startTest } from "@/lib/assessments/testService";
import type { TestSummary } from "@/lib/assessments/testService";
import type { WeakTopic } from "@/lib/assessments/weakTopics";

interface Subject {
  id: string;
  name: string;
}

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40";

export function TestsView({
  subjects,
  initialTests,
  weakTopics,
}: {
  subjects: Subject[];
  initialTests: TestSummary[];
  weakTopics: WeakTopic[];
}) {
  const router = useRouter();
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [questionCount, setQuestionCount] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  async function handleStart() {
    setError(null);
    setStarting(true);
    const result = await startTest(subjectId, questionCount);
    setStarting(false);
    if (!result.success || !result.testId) {
      setError(result.error ?? "Something went wrong.");
      return;
    }
    router.push(`/tests/${result.testId}`);
  }

  return (
    <div className="flex animate-fade-up flex-col gap-6">
      <section className="panel-cosmic flex flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold text-ink">Start a new test</h2>
        {subjects.length === 0 ? (
          <p className="rounded-lg border border-border bg-cosmic-deep/40 px-4 py-6 text-center text-sm text-ink-faint">
            No subjects yet — add subjects and questions before starting a test.
          </p>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium text-ink">
              Subject
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className={fieldClass}
              >
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-ink">
              Number of questions
              <input
                type="number"
                min={1}
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className={fieldClass}
              />
            </label>
            <button
              type="button"
              disabled={starting}
              onClick={handleStart}
              className="rounded-lg bg-brand px-4 py-2 font-semibold text-cosmic-void shadow-glow transition hover:bg-brand-dark disabled:opacity-60"
            >
              {starting ? "Starting…" : "Start test"}
            </button>
          </div>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
      </section>

      <section className="panel-cosmic flex flex-col gap-3 p-6">
        <h2 className="text-lg font-semibold text-ink">Weak topics</h2>
        {weakTopics.length === 0 ? (
          <p className="text-sm text-ink-faint">Not enough data yet — complete a few more tests to see weak topics.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {weakTopics.map((topic) => (
              <li
                key={topic.topic}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-cosmic-deep/40 px-4 py-2 text-sm"
              >
                <span className="font-medium text-ink">{topic.topic}</span>
                <span className="text-ink-muted">
                  {topic.wrongRate}% wrong across {topic.attempts} attempts
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel-cosmic flex flex-col gap-3 p-6">
        <h2 className="text-lg font-semibold text-ink">Test history</h2>
        {initialTests.length === 0 ? (
          <p className="rounded-lg border border-border bg-cosmic-deep/40 px-4 py-6 text-center text-sm text-ink-faint">
            No tests yet — start one above to begin tracking your progress.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {initialTests.map((test) => (
              <li key={test.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <Link href={`/tests/${test.id}`} className="text-sm font-medium text-ink hover:text-brand">
                    {test.subjectName}
                  </Link>
                  <p className="text-xs text-ink-muted">
                    {test.createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-medium text-ink-muted">
                  {test.status === "completed" ? `${test.scorePercent}%` : "In progress"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
