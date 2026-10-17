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
      <p className="rounded-xl bg-blush p-4 text-sm text-slate-700">
        No study time set for today. Add your weekly availability in{" "}
        <Link href="/profile" className="underline">your profile</Link> to get a personalized plan.
      </p>
    );
  }

  if (planDayStatus === "caught-up") {
    return <p className="text-slate-500">No tasks or study blocks for today — you&apos;re all caught up.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="flex flex-col gap-2">
        {entries.map((entry) => (
          <li key={entry.id} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className={entry.checkInStatus === "done" ? "text-slate-400 line-through" : ""}>{entry.title}</p>
                <p className="text-xs text-slate-500">{entry.estimatedMinutes} min</p>
                {entry.carriedOverFromDate && <p className="text-xs text-lavender-dark">Carried over from yesterday</p>}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => handleCheckIn(entry.id, "done")}
                  aria-label={`Mark ${entry.title} done`}
                  className="rounded-full bg-lavender px-3 py-1 text-xs text-white"
                >
                  Done
                </button>
                <button
                  onClick={() => handleCheckIn(entry.id, "partial")}
                  aria-label={`Mark ${entry.title} partial`}
                  className="rounded-full border border-lavender px-3 py-1 text-xs text-lavender-dark"
                >
                  Partial
                </button>
                <button
                  onClick={() => handleCheckIn(entry.id, "not_done")}
                  aria-label={`Mark ${entry.title} not done`}
                  className="rounded-full border border-lavender px-3 py-1 text-xs text-lavender-dark"
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
