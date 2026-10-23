"use client";

import { useState } from "react";
import Link from "next/link";
import { signupStudent } from "@/lib/auth/signup";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [emailDelivered, setEmailDelivered] = useState(false);

  function handlePasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPassword(e.target.value);
    setError(null);
  }

  function handleConfirmPasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
    setConfirmPassword(e.target.value);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setStatus("submitting");
    try {
      const result = await signupStudent({ email, password });
      if (result.success) {
        setEmailDelivered(Boolean(result.emailDelivered));
        setStatus("success");
      } else {
        setStatus("error");
        setError(result.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setError("Something went wrong. Please try again.");
    }
  }

  if (status === "success") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface-page px-4 py-16">
        <div className="w-full max-w-md rounded-2xl border border-border bg-white p-8 text-center shadow-sm">
          <h1 className="mb-4 text-2xl font-semibold text-ink">Check your email</h1>
          {emailDelivered ? (
            <p className="text-ink-muted">
              We&apos;ve sent a verification link to <strong>{email}</strong>. Click it to activate your account.
            </p>
          ) : (
            <p className="text-ink-muted">
              No email provider is configured in this environment, so nothing was actually emailed. You can
              find your verification link in the{" "}
              <Link href="/dev/emails" className="font-medium text-brand underline">
                local dev inbox
              </Link>{" "}
              instead.
            </p>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-page px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-border bg-white p-8 shadow-sm">
        <Link href="/" className="mb-6 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-xs font-bold text-white">SR</span>
          <span className="text-sm font-semibold text-ink">Study Reminder</span>
        </Link>
        <h1 className="mb-1 text-2xl font-semibold text-ink">Create your account</h1>
        <p className="mb-6 text-sm text-ink-muted">Start planning your study routine in minutes.</p>
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
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-ink">Password</span>
            <input
              type="password"
              required
              minLength={10}
              value={password}
              onChange={handlePasswordChange}
              className="rounded-lg border border-border px-4 py-2 transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-ink">Confirm password</span>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={handleConfirmPasswordChange}
              aria-invalid={!!error}
              aria-describedby={error ? "password-match-error" : undefined}
              className="rounded-lg border border-border px-4 py-2 transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </label>
          {error && (
            <p id="password-match-error" role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={status === "submitting"}
            className="mt-2 w-full rounded-full bg-brand px-6 py-3 font-medium text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "submitting" ? "Creating account..." : "Create account"}
          </button>
        </form>
        <p className="mt-6 text-sm text-ink-muted">
          Already have an account? <Link href="/login" className="font-medium text-brand underline">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
