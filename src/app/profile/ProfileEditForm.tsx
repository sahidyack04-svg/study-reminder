"use client";

import { useState } from "react";
import { updateStudentProfile, type ProfileEditableFields } from "@/lib/onboarding/updateProfile";

export interface ProfileEditFormProps {
  userId: string;
  initial: ProfileEditableFields;
  guardianStatus: { email: string; approved: boolean } | null;
}

export function ProfileEditForm({ userId, initial, guardianStatus }: ProfileEditFormProps) {
  const [form, setForm] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof ProfileEditableFields>(key: K, value: ProfileEditableFields[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError(null);
    const result = await updateStudentProfile(userId, form);
    if (result.success) {
      setStatus("saved");
    } else {
      setStatus("error");
      setError(result.error ?? "Something went wrong.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl bg-white p-6 shadow-sm">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700">Name</span>
        <input
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          className="rounded-lg border border-lavender px-4 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700">Date of birth</span>
        <input
          type="date"
          value={form.dateOfBirth}
          onChange={(e) => update("dateOfBirth", e.target.value)}
          className="rounded-lg border border-lavender px-4 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700">Grade</span>
        <input
          value={form.grade}
          onChange={(e) => update("grade", e.target.value)}
          className="rounded-lg border border-lavender px-4 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700">School</span>
        <input
          value={form.schoolName}
          onChange={(e) => update("schoolName", e.target.value)}
          className="rounded-lg border border-lavender px-4 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700">Curriculum</span>
        <input
          value={form.curriculum}
          onChange={(e) => update("curriculum", e.target.value)}
          className="rounded-lg border border-lavender px-4 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700">Academic year</span>
        <input
          value={form.academicYear}
          onChange={(e) => update("academicYear", e.target.value)}
          className="rounded-lg border border-lavender px-4 py-2"
        />
      </label>

      {guardianStatus && (
        <div className="rounded-lg bg-blush p-4">
          <p className="mb-2 text-sm text-slate-600">
            Guardian: {guardianStatus.email} — {guardianStatus.approved ? "approved" : "pending approval"}
          </p>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">Update guardian name</span>
            <input
              value={form.guardian?.name ?? ""}
              onChange={(e) => update("guardian", { name: e.target.value, email: form.guardian?.email ?? "" })}
              className="rounded-lg border border-lavender px-4 py-2"
            />
          </label>
          <label className="mt-2 flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">Update guardian email</span>
            <input
              value={form.guardian?.email ?? ""}
              onChange={(e) => update("guardian", { name: form.guardian?.name ?? "", email: e.target.value })}
              className="rounded-lg border border-lavender px-4 py-2"
            />
          </label>
          <p className="mt-2 text-xs text-slate-500">
            Changing the guardian&apos;s name or email will re-send a consent request.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {status === "saved" && <p className="text-sm text-green-700">Saved.</p>}

      <button
        type="submit"
        disabled={status === "saving"}
        className="self-start rounded-full bg-pink px-6 py-3 font-medium text-white hover:bg-pink-dark disabled:opacity-60"
      >
        {status === "saving" ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}
