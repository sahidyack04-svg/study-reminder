"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { verifyEmailToken, resendVerificationEmail } from "@/lib/auth/verifyEmail";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"idle" | "verifying" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function handleVerify() {
    if (!token) return;
    setStatus("verifying");
    try {
      const result = await verifyEmailToken(token);
      if (result.success) {
        setStatus("success");
      } else {
        setStatus("error");
        setError(result.error ?? "This verification link is invalid.");
      }
    } catch {
      setStatus("error");
      setError("Something went wrong. Please try again.");
    }
  }

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    await resendVerificationEmail(email);
    setSent(true);
  }

  if (!token) {
    if (sent) {
      return (
        <p className="text-ink-muted">
          If an account exists for <strong>{email}</strong> and isn&apos;t verified yet, we&apos;ve sent a
          new link. (Testing locally without an email provider configured? Check the{" "}
          <Link href="/dev/emails" className="text-brand underline">
            local dev inbox
          </Link>
          .)
        </p>
      );
    }

    return (
      <>
        <h1 className="mb-4 text-2xl font-semibold text-brand">Verify your email</h1>
        <p className="mb-6 text-ink-muted">
          Check your email for a verification link to activate your account. Link expired or never
          arrived? Enter your email and we&apos;ll send a new one.
        </p>
        <form onSubmit={handleResend} className="flex flex-col gap-4 text-left">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-ink">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-border px-4 py-2"
            />
          </label>
          <button
            type="submit"
            className="mt-2 rounded-full bg-brand px-6 py-3 font-medium text-white hover:bg-brand-dark"
          >
            Resend verification email
          </button>
        </form>
      </>
    );
  }

  if (status === "success") {
    return (
      <>
        <h1 className="mb-4 text-2xl font-semibold text-brand">Email verified!</h1>
        <Link href="/login" className="text-brand underline">
          Log in to continue
        </Link>
      </>
    );
  }

  if (status === "error") {
    return (
      <>
        <h1 className="mb-4 text-2xl font-semibold text-brand">Verification failed</h1>
        <p className="text-ink-muted">{error}</p>
      </>
    );
  }

  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold text-brand">Verify your email</h1>
      <p className="mb-6 text-ink-muted">Click below to confirm your email address and activate your account.</p>
      <button
        type="button"
        onClick={handleVerify}
        disabled={status === "verifying"}
        className="rounded-full bg-brand px-6 py-3 font-medium text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {status === "verifying" ? "Verifying..." : "Verify my email"}
      </button>
    </>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-page px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-border bg-white p-8 text-center shadow-sm">
        <Suspense fallback={<p className="text-ink-muted">Loading...</p>}>
          <VerifyEmailContent />
        </Suspense>
      </div>
    </main>
  );
}
