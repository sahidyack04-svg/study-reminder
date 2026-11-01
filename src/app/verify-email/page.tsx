"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { verifyEmailToken, resendVerificationEmail } from "@/lib/auth/verifyEmail";
import { Starfield } from "@/components/cosmic/Starfield";
import { Logo } from "@/components/cosmic/Logo";

function ResendForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await resendVerificationEmail(email);
    } catch {
      // resendVerificationEmail never throws, but the confirmation stays
      // generic either way so a failure can't be distinguished from success.
    }
    setSent(true);
    setSubmitting(false);
  }

  if (sent) {
    return (
      <p className="text-sm text-ink-muted">
        If an account exists for <strong className="text-ink">{email}</strong> and isn&apos;t verified yet, we&apos;ve
        sent a new verification link.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-ink">Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="glow-interactive w-full rounded-lg bg-brand px-4 py-2 font-semibold text-cosmic-void shadow-glow transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Sending..." : "Resend verification email"}
      </button>
    </form>
  );
}

function VerifyEmailContent() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<"checking" | "success" | "error">(token ? "checking" : "error");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    verifyEmailToken(token).then((result) => {
      if (result.success) {
        setState("success");
      } else {
        setState("error");
        setError(result.error ?? "This verification link is invalid.");
      }
    });
  }, [token]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <Starfield intensity="ambient" />
      <div className="panel-cosmic-raised w-full max-w-md animate-fade-up p-8 text-center">
        <Logo size={28} className="mx-auto mb-6 w-fit" />

        {state === "checking" && <p className="text-ink-muted">Verifying your email...</p>}

        {state === "success" && (
          <>
            <h1 className="text-glow mb-3 text-2xl font-semibold text-brand">Email verified</h1>
            <p className="mb-6 text-ink-muted">Your account is active. You can sign in now.</p>
            <Link
              href="/login"
              className="glow-interactive inline-block w-full rounded-lg bg-brand px-4 py-2 font-semibold text-cosmic-void shadow-glow transition hover:bg-brand-dark"
            >
              Go to login
            </Link>
          </>
        )}

        {state === "error" && (
          <>
            <h1 className="mb-3 text-2xl font-semibold text-ink">
              {token ? "Verification link problem" : "Resend your verification email"}
            </h1>
            {error && <p className="mb-6 text-sm text-danger">{error}</p>}
            {!token && (
              <p className="mb-6 text-sm text-ink-muted">
                Enter your email and we&apos;ll send you a new verification link.
              </p>
            )}
            <div className="text-left">
              <ResendForm />
            </div>
          </>
        )}

        <Link href="/login" className="mt-6 inline-block text-sm text-brand underline underline-offset-2 transition hover:text-brand-dark">
          Back to login
        </Link>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
