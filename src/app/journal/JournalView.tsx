"use client";

import { useState } from "react";
import { saveJournalEntry } from "@/lib/journal/journal";

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
    <div className="flex flex-col gap-8">
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-medium text-lavender-dark">Today</h2>
        <textarea
          placeholder="How was today? What did you study, how did it go?"
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setStatus("idle");
          }}
          rows={6}
          className="w-full rounded-lg border border-lavender px-4 py-2"
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {status === "saved" && <p className="mt-2 text-sm text-green-700">Saved.</p>}
        <button
          onClick={handleSave}
          disabled={status === "saving"}
          className="mt-3 rounded-full bg-pink px-6 py-2 font-medium text-white hover:bg-pink-dark disabled:opacity-60"
        >
          {status === "saving" ? "Saving..." : "Save"}
        </button>
      </div>

      {pastEntries.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-medium text-lavender-dark">Past entries</h2>
          {pastEntries.map((entry) => (
            <div key={entry.id} className="rounded-xl bg-blush p-4">
              <p className="mb-1 text-xs text-slate-500">{entry.date.toLocaleDateString()}</p>
              <p className="whitespace-pre-wrap text-slate-700">{entry.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
