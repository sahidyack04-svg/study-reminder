"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { approveGuardianConsent } from "@/lib/onboarding/guardianConsentActions";

export default function GuardianConsentPage() {
  const params = useParams<{ token: string }>();
  const [result, setResult] = useState<{ success: boolean; error?: string; alreadyApproved?: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleApprove() {
    setSubmitting(true);
    const outcome = await approveGuardianConsent(params.token);
    setResult(outcome);
    setSubmitting(false);
  }

  if (result) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        {result.success ? (
          <p className="text-slate-600">
            {result.alreadyApproved
              ? "This account was already approved. Thank you!"
              : "Thank you — you've approved this student's account."}
          </p>
        ) : (
          <p className="text-red-600">{result.error}</p>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="mb-4 text-2xl font-semibold text-pink-dark">Guardian approval requested</h1>
      <p className="mb-8 text-slate-600">
        A student has listed you as their guardian on Study Reminder and needs your consent to use the app.
      </p>
      <button
        onClick={handleApprove}
        disabled={submitting}
        className="rounded-full bg-pink px-6 py-3 font-medium text-white hover:bg-pink-dark disabled:opacity-60"
      >
        {submitting ? "Submitting..." : "Yes, I approve"}
      </button>
    </main>
  );
}
