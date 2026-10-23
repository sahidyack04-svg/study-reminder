"use client";

import { useState } from "react";
import { getProgressData, type ProgressData } from "@/lib/progress/progressService";
import { CompletionChart } from "./CompletionChart";
import { SubjectTimeChart } from "./SubjectTimeChart";

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
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <p className="text-sm text-ink-muted">Check-in streak</p>
        <p className="text-3xl font-semibold text-brand">{streak}</p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => handleToggle("week")}
          className={`rounded-full px-4 py-1 text-sm ${windowSize === "week" ? "bg-brand text-white" : "border border-border text-brand"}`}
        >
          Week
        </button>
        <button
          onClick={() => handleToggle("month")}
          className={`rounded-full px-4 py-1 text-sm ${windowSize === "month" ? "bg-brand text-white" : "border border-border text-brand"}`}
        >
          Month
        </button>
      </div>

      {loading ? (
        <p className="text-ink-muted">Loading...</p>
      ) : !data.hasActivity ? (
        <p className="rounded-xl bg-brand-light p-4 text-sm text-ink">No study activity yet in this period.</p>
      ) : (
        <>
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-medium text-brand">Daily completion</h2>
            {data.completion.length > 0 ? (
              <CompletionChart data={data.completion} />
            ) : (
              <p className="text-sm text-ink-muted">No study activity yet in this period.</p>
            )}
          </div>
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-medium text-brand">Time by subject</h2>
            {data.subjectTime.length > 0 ? (
              <SubjectTimeChart data={data.subjectTime} />
            ) : (
              <p className="text-sm text-ink-muted">No subject-tagged study time yet in this period.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
