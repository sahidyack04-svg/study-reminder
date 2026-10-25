"use client";

import { useState } from "react";
import Link from "next/link";
import { checkInPlanEntry } from "@/lib/plan/planService";
import { getPlanDayStatus } from "@/lib/plan/planDayStatus";

interface PlanEntryView {
  id: string;
  title: string;
  estimatedMinutes: number;
  checkInStatus: string;
  carriedOverFromDate: Date | string | null;
}

export function PlanView({ entries: initial, capacityMinutes }: { entries: PlanEntryView[]; capacityMinutes: number }) {
  const [entries, setEntries] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckIn(id: string, status: "done" | "partial" | "not_done") {
    setError(null);
    const result = await checkInPlanEntry(id, status);
    if (result.success) {
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, checkInStatus: status } : e)));
    } else {
      setError(result.error ?? "Something went wrong updating that item.");
    }
  }

  const planDayStatus = getPlanDayStatus(entries.length, capacityMinutes);

  if (planDayStatus === "no-availability") {
    return (
      <p className="panel-cosmic animate-fade-up border-brand/25 bg-brand-light p-4 text-sm text-ink">
        No study time set for today. Add your weekly availability in{" "}
        <Link href="/profile" className="font-medium text-brand underline underline-offset-2 hover:text-brand-dark">your profile</Link> to get a personalized plan.
      </p>
    );
  }

  if (planDayStatus === "caught-up") {
    return (
      <p className="panel-cosmic animate-fade-up p-6 text-center text-sm text-ink-muted">
        No tasks or study blocks for today — you&apos;re all caught up.
      </p>
    );
  }

  return (
    <div className="flex animate-fade-up flex-col gap-3">
      {error && (
        <p className="rounded-lg border border-danger/30 bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>
      )}
      <ul className="flex flex-col gap-2">
        {entries.map((entry) => (
          <li key={entry.id} className="panel-cosmic-raised glow-interactive p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p
                  className={
                    entry.checkInStatus === "done"
                      ? "text-sm text-ink-faint line-through"
                      : "text-sm font-medium text-ink"
                  }
                >
                  {entry.title}
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">{entry.estimatedMinutes} min</p>
                {entry.carriedOverFromDate && (
                  <p className="mt-1 text-xs font-medium text-brand">Carried over from yesterday</p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => handleCheckIn(entry.id, "done")}
                  aria-label={`Mark ${entry.title} done`}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    entry.checkInStatus === "done"
                      ? "border-success/50 bg-success-light text-success"
                      : "border-border text-ink-muted hover:border-success/50 hover:text-success"
                  }`}
                >
                  Done
                </button>
                <button
                  onClick={() => handleCheckIn(entry.id, "partial")}
                  aria-label={`Mark ${entry.title} partial`}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    entry.checkInStatus === "partial"
                      ? "border-warning/50 bg-warning-light text-warning"
                      : "border-border text-ink-muted hover:border-warning/50 hover:text-warning"
                  }`}
                >
                  Partial
                </button>
                <button
                  onClick={() => handleCheckIn(entry.id, "not_done")}
                  aria-label={`Mark ${entry.title} not done`}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    entry.checkInStatus === "not_done"
                      ? "border-danger/50 bg-danger-light text-danger"
                      : "border-border text-ink-muted hover:border-danger/50 hover:text-danger"
                  }`}
                >
                  Not done
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
