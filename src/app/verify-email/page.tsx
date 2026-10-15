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
        <p className="text-slate-600">
          If an account exists for <strong>{email}</strong> and isn&apos;t verified yet, we&apos;ve sent a
          new link.
        </p>
      );
    }

    return (
      <>
        <h1 className="mb-4 text-2xl font-semibold text-pink-dark">Verify your email</h1>
        <p className="mb-6 text-slate-600">
          Check your email for a verification link to activate your account. Link expired or never
          arrived? Enter your email and we&apos;ll send a new one.
        </p>
        <form onSubmit={handleResend} className="flex flex-col gap-4 text-left">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-lavender px-4 py-2"
            />
          </label>
          <button
            type="submit"
            className="mt-2 rounded-full bg-pink px-6 py-3 font-medium text-white hover:bg-pink-dark"
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
        <h1 className="mb-4 text-2xl font-semibold text-pink-dark">Email verified!</h1>
        <Link href="/login" className="text-lavender-dark underline">
          Log in to continue
        </Link>
      </>
    );
  }

  if (status === "error") {
    return (
      <>
        <h1 className="mb-4 text-2xl font-semibold text-pink-dark">Verification failed</h1>
        <p className="text-slate-600">{error}</p>
      </>
    );
  }

  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold text-pink-dark">Verify your email</h1>
      <p className="mb-6 text-slate-600">Click below to confirm your email address and activate your account.</p>
      <button
        type="button"
        onClick={handleVerify}
        disabled={status === "verifying"}
        className="rounded-full bg-pink px-6 py-3 font-medium text-white hover:bg-pink-dark disabled:opacity-60"
      >
        {status === "verifying" ? "Verifying..." : "Verify my email"}
      </button>
    </>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="mx-auto max-w-md px-6 py-24 text-center">
      <Suspense fallback={<p className="text-slate-600">Loading...</p>}>
        <VerifyEmailContent />
      </Suspense>
    </main>
  );
}
