"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { approveGuardianConsent } from "@/lib/onboarding/guardianConsentActions";
import { Starfield } from "@/components/cosmic/Starfield";
import { Logo } from "@/components/cosmic/Logo";

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
      <main className="flex min-h-screen items-center justify-center px-4 py-16 text-center">
        <Starfield intensity="ambient" />
        <div className="animate-fade-up w-full max-w-md panel-cosmic-raised p-8">
          <Logo size={28} className="mx-auto mb-6 w-fit" />
          {result.success ? (
            <p className="text-ink-muted">
              {result.alreadyApproved
                ? "This account was already approved. Thank you!"
                : "Thank you — you've approved this student's account."}
            </p>
          ) : (
            <p className="text-danger">{result.error}</p>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16 text-center">
      <Starfield intensity="ambient" />
      <div className="animate-fade-up w-full max-w-md panel-cosmic-raised p-8">
        <Logo size={28} className="mx-auto mb-6 w-fit" />
        <h1 className="mb-4 text-2xl font-semibold text-ink">Guardian approval requested</h1>
        <p className="mb-8 text-ink-muted">
          A student has listed you as their guardian on Study Reminder and needs your consent to use the app.
        </p>
        <button
          onClick={handleApprove}
          disabled={submitting}
          className="rounded-lg bg-brand px-6 py-3 font-semibold text-cosmic-void shadow-glow transition hover:bg-brand-dark disabled:opacity-60"
        >
          {submitting ? "Submitting..." : "Yes, I approve"}
        </button>
      </div>
    </main>
  );
}
