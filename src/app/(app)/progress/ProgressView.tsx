"use client";

import { useState } from "react";
import { getProgressData, type ProgressData } from "@/lib/progress/progressService";
import { CompletionChart } from "./CompletionChart";
import { SubjectTimeChart } from "./SubjectTimeChart";
import { ActivityCalendar } from "./ActivityCalendar";

export function ProgressView({
  initialWindow,
  initialData,
  streak,
}: {
  initialWindow: "week" | "month";
  initialData: ProgressData;
  streak: number;
}) {
  const [windowSize, setWindowSize] = useState(initialWindow);
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);

  async function handleToggle(next: "week" | "month") {
    setWindowSize(next);
    setLoading(true);
    const result = await getProgressData(next);
    setData(result);
    setLoading(false);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="panel-cosmic animate-pulse-glow p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Check-in streak</p>
        <p className="text-glow mt-1 text-3xl font-semibold text-brand">{streak}</p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => handleToggle("week")}
          className={`glow-interactive rounded-full px-4 py-1 text-sm transition ${
            windowSize === "week"
              ? "border border-brand/40 bg-brand font-semibold text-cosmic-void shadow-glow"
              : "border border-border text-ink-muted hover:border-brand hover:text-brand"
          }`}
        >
          Week
        </button>
        <button
          onClick={() => handleToggle("month")}
          className={`glow-interactive rounded-full px-4 py-1 text-sm transition ${
            windowSize === "month"
              ? "border border-brand/40 bg-brand font-semibold text-cosmic-void shadow-glow"
              : "border border-border text-ink-muted hover:border-brand hover:text-brand"
          }`}
        >
          Month
        </button>
      </div>

      {loading ? (
        <p className="text-ink-muted">Loading...</p>
      ) : !data.hasActivity ? (
        <p className="rounded-lg border border-border bg-cosmic-deep/40 px-4 py-6 text-center text-sm text-ink-faint">No study activity yet in this period.</p>
      ) : (
        <>
          <div className="panel-cosmic-raised animate-fade-up p-6">
            <h2 className="mb-4 text-lg font-medium text-ink">Daily completion</h2>
            {data.completion.length > 0 ? (
              <CompletionChart data={data.completion} />
            ) : (
              <p className="rounded-lg border border-border bg-cosmic-deep/40 px-4 py-6 text-center text-sm text-ink-faint">No study activity yet in this period.</p>
            )}
          </div>
          <div className="panel-cosmic-raised animate-fade-up p-6">
            <h2 className="mb-4 text-lg font-medium text-ink">Time by subject</h2>
            {data.subjectTime.length > 0 ? (
              <SubjectTimeChart data={data.subjectTime} />
            ) : (
              <p className="rounded-lg border border-border bg-cosmic-deep/40 px-4 py-6 text-center text-sm text-ink-faint">No subject-tagged study time yet in this period.</p>
            )}
          </div>
          <div className="panel-cosmic p-6">
            <h2 className="mb-4 text-lg font-medium text-ink">Activity calendar</h2>
            <ActivityCalendar data={data.completion} />
          </div>
        </>
      )}
    </div>
  );
}
