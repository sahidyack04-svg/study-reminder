"use client";

import { formatUTCDate } from "@/lib/validation/age";
import type { CompletionPoint } from "@/lib/progress/completionChart";

export function ActivityCalendar({ data }: { data: CompletionPoint[] }) {
  if (data.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-cosmic-deep/40 px-4 py-6 text-center text-sm text-ink-faint">
        No activity yet in this period.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-7 gap-2 rounded-lg border border-border bg-cosmic-deep/40 p-3">
      {data.map((point) => {
        const formattedDate = point.date.toISOString().slice(0, 10);
        const opacity = Math.max(0.15, point.percentDone / 100);

        return (
          <div
            key={formattedDate}
            data-testid={`activity-cell-${formattedDate}`}
            data-has-activity="true"
            className="aspect-square rounded"
            style={{
              backgroundColor: "#e87ba4",
              opacity,
            }}
            title={`${formatUTCDate(point.date)}: ${point.percentDone}% done`}
          />
        );
      })}
    </div>
  );
}
