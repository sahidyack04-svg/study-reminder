"use client";

import { useState } from "react";
import { saveJournalEntry } from "@/lib/journal/journal";
import { formatUTCDate } from "@/lib/validation/age";

interface JournalEntryView {
  id: string;
  date: Date;
  content: string;
}

export function JournalView({
  todayEntry,
  pastEntries,
}: {
  todayEntry: JournalEntryView | null;
  pastEntries: JournalEntryView[];
}) {
  const [content, setContent] = useState(todayEntry?.content ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setStatus("saving");
    setError(null);
    const result = await saveJournalEntry(content);
    if (result.success) {
      setStatus("saved");
    } else {
      setStatus("idle");
      setError(result.error ?? "Something went wrong.");
    }
  }

  return (
    <div className="flex animate-fade-up flex-col gap-8">
      <div className="panel-cosmic-raised p-6">
        <h2 className="mb-2 text-lg font-medium text-brand">Today</h2>
        <textarea
          placeholder="How was today? What did you study, how did it go?"
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setStatus("idle");
          }}
          rows={6}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
        />
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        {status === "saved" && <p className="mt-2 text-sm text-success">Saved.</p>}
        <button
          onClick={handleSave}
          disabled={status === "saving"}
          className="mt-3 rounded-lg bg-brand px-4 py-2 font-semibold text-cosmic-void shadow-glow transition hover:bg-brand-dark disabled:opacity-60"
        >
          {status === "saving" ? "Saving..." : "Save"}
        </button>
      </div>

      {pastEntries.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-medium text-brand">Past entries</h2>
          {pastEntries.map((entry) => (
            <div key={entry.id} className="panel-cosmic p-4">
              <p className="mb-1 text-xs font-medium text-ink-muted">{formatUTCDate(entry.date)}</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{entry.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
