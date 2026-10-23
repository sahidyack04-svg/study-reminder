"use client";

import { useState } from "react";
import { updateStudentProfile, type ProfileEditableFields } from "@/lib/onboarding/updateProfile";
import { resendGuardianConsentForCurrentUser } from "@/lib/onboarding/guardianConsentActions";
import { requiresGuardianConsent } from "@/lib/validation/age";

export interface ProfileEditFormProps {
  initial: ProfileEditableFields;
  guardianStatus: { email: string; approved: boolean } | null;
}

export function ProfileEditForm({ initial, guardianStatus }: ProfileEditFormProps) {
  const [form, setForm] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [resendError, setResendError] = useState<string | null>(null);

  function update<K extends keyof ProfileEditableFields>(key: K, value: ProfileEditableFields[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError(null);
    const result = await updateStudentProfile(form);
    if (result.success) {
      setStatus("saved");
    } else {
      setStatus("error");
      setError(result.error ?? "Something went wrong.");
    }
  }

  async function handleResendConsent() {
    setResendStatus("sending");
    setResendError(null);
    try {
      const result = await resendGuardianConsentForCurrentUser();
      if (result.success) {
        setResendStatus("sent");
      } else {
        setResendStatus("error");
        setResendError(result.error ?? "Something went wrong.");
      }
    } catch {
      setResendStatus("error");
      setResendError("Something went wrong. Please try again.");
    }
  }

  // Client-side hint only, using the exact same age threshold the server uses
  // (asOf defaults to the browser's local now). The server re-validates
  // authoritatively against the student's declared timezone regardless.
  const isMinor = form.dateOfBirth ? requiresGuardianConsent(new Date(form.dateOfBirth)) : false;
  const showGuardianFields = !!guardianStatus || isMinor;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl bg-white p-6 shadow-sm">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-ink">Name</span>
        <input
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          className="rounded-lg border border-border px-4 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-ink">Date of birth</span>
        <input
          type="date"
          value={form.dateOfBirth}
          onChange={(e) => update("dateOfBirth", e.target.value)}
          className="rounded-lg border border-border px-4 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-ink">Grade</span>
        <input
          value={form.grade}
          onChange={(e) => update("grade", e.target.value)}
          className="rounded-lg border border-border px-4 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-ink">School</span>
        <input
          value={form.schoolName}
          onChange={(e) => update("schoolName", e.target.value)}
          className="rounded-lg border border-border px-4 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-ink">Curriculum</span>
        <input
          value={form.curriculum}
          onChange={(e) => update("curriculum", e.target.value)}
          className="rounded-lg border border-border px-4 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-ink">Academic year</span>
        <input
          value={form.academicYear}
          onChange={(e) => update("academicYear", e.target.value)}
          className="rounded-lg border border-border px-4 py-2"
        />
      </label>

      {showGuardianFields && (
        <div className="rounded-lg bg-brand-light p-4">
          {guardianStatus ? (
            <p className="mb-2 text-sm text-ink-muted">
              Guardian: {guardianStatus.email} — {guardianStatus.approved ? "approved" : "pending approval"}
            </p>
          ) : (
            <p className="mb-2 text-sm text-ink-muted">
              Since you may be under 18, we need a guardian&apos;s name and email to approve your account.
            </p>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-ink">
              {guardianStatus ? "Update guardian name" : "Guardian name"}
            </span>
            <input
              value={form.guardian?.name ?? ""}
              onChange={(e) => update("guardian", { name: e.target.value, email: form.guardian?.email ?? "" })}
              className="rounded-lg border border-border px-4 py-2"
            />
          </label>
          <label className="mt-2 flex flex-col gap-1">
            <span className="text-sm font-medium text-ink">
              {guardianStatus ? "Update guardian email" : "Guardian email"}
            </span>
            <input
              value={form.guardian?.email ?? ""}
              onChange={(e) => update("guardian", { name: form.guardian?.name ?? "", email: e.target.value })}
              className="rounded-lg border border-border px-4 py-2"
            />
          </label>
          <p className="mt-2 text-xs text-ink-muted">
            {guardianStatus
              ? "Changing the guardian's name or email will re-send a consent request."
              : "Saving will send your guardian a consent request."}
          </p>
          {guardianStatus && !guardianStatus.approved && (
            <div className="mt-3">
              <button
                type="button"
                onClick={handleResendConsent}
                disabled={resendStatus === "sending"}
                className="rounded-full border border-border px-4 py-2 text-sm text-brand disabled:opacity-60"
              >
                {resendStatus === "sending" ? "Sending..." : "Resend consent email"}
              </button>
              {resendStatus === "sent" && (
                <p className="mt-2 text-sm text-green-700">Consent email sent again.</p>
              )}
              {resendStatus === "error" && resendError && (
                <p className="mt-2 text-sm text-red-600">{resendError}</p>
              )}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {status === "saved" && <p className="text-sm text-green-700">Saved.</p>}

      <button
        type="submit"
        disabled={status === "saving"}
        className="self-start rounded-full bg-brand px-6 py-3 font-medium text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {status === "saving" ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}
