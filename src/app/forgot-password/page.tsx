"use client";

import { useState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/lib/auth/passwordReset";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await requestPasswordReset(email);
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
      <main className="flex min-h-screen items-center justify-center bg-surface-page px-4 py-16">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-md">
          <h1 className="mb-3 text-2xl font-semibold text-brand">Check your email</h1>
          <p className="text-ink-muted">
            If an account exists for <strong>{email}</strong>, we&apos;ve sent a password reset link.
          </p>
          <Link href="/login" className="mt-6 inline-block text-sm text-brand underline">
            Back to login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-page px-4 py-16">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-md">
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-border px-4 py-2 transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full rounded-full bg-brand px-6 py-3 font-medium text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Sending..." : "Send reset link"}
          </button>
        </form>
        <Link href="/login" className="mt-6 inline-block text-sm text-brand underline">
          Back to login
        </Link>
      </div>
    </main>
  );
}
