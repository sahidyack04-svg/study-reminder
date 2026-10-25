"use client";

import { useState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/lib/auth/passwordReset";
import { Starfield } from "@/components/cosmic/Starfield";
import { Logo } from "@/components/cosmic/Logo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const result = await requestPasswordReset(email);
      setEmailAvailable(result.emailAvailable ?? true);
    } catch {
      // requestPasswordReset never throws, but guard against a genuine
      // client-side network failure reaching the server action. The
      // confirmation stays generic either way, so a failed request can't
      // be distinguished from a successful one (anti-enumeration).
    }
    setSent(true);
    setSubmitting(false);
  }

  if (sent) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-16">
        <Starfield intensity="ambient" />
        <div className="panel-cosmic-raised w-full max-w-md animate-burst-in p-8 text-center">
          <Logo size={28} className="mx-auto mb-6 w-fit" />
          {emailAvailable ? (
            <>
              <h1 className="text-glow mb-3 text-2xl font-semibold text-brand">Check your email</h1>
              <p className="text-ink-muted">
                If an account exists for <strong className="text-ink">{email}</strong>, we&apos;ve sent a password reset link.
              </p>
            </>
          ) : (
            <>
              <h1 className="mb-3 text-2xl font-semibold text-ink">Password reset unavailable</h1>
              <p className="text-ink-muted">
                Password reset by email is temporarily unavailable in this environment. Please contact support for help
                regaining access to your account.
              </p>
            </>
          )}
          <Link href="/login" className="mt-6 inline-block text-sm text-brand underline underline-offset-2 transition hover:text-brand-dark">
            Back to login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <Starfield intensity="ambient" />
      <div className="panel-cosmic-raised w-full max-w-md animate-fade-up p-8">
        <Logo size={28} className="mb-6 w-fit" />
        <h1 className="mb-2 text-2xl font-semibold text-brand">Reset your password</h1>
        <p className="mb-6 text-sm text-ink-muted">
          Enter the email address on your account and we&apos;ll send you a link to reset your password.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
            className="glow-interactive mt-2 w-full rounded-lg bg-brand px-4 py-2 font-semibold text-cosmic-void shadow-glow transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Sending..." : "Send reset link"}
          </button>
        </form>
        <Link href="/login" className="mt-6 inline-block text-sm text-brand underline underline-offset-2 transition hover:text-brand-dark">
          Back to login
        </Link>
      </div>
    </main>
  );
}
