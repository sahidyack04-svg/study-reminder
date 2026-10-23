"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { resetPassword } from "@/lib/auth/passwordReset";

function ResetPasswordContent() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await resetPassword(token, password);
    if (result.success) {
      setSuccess(true);
      setTimeout(() => router.push("/login"), 1500);
    } else {
      setError(result.error ?? "Something went wrong.");
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface-page px-4 py-16">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-md">
          <h1 className="mb-3 text-2xl font-semibold text-brand">Password updated</h1>
          <p className="text-ink-muted">Redirecting you to login...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-page px-4 py-16">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-md">
        <h1 className="mb-2 text-2xl font-semibold text-brand">Choose a new password</h1>
        <p className="mb-6 text-sm text-ink-muted">
          Enter a new password for your account. It must be at least 10 characters.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-ink">New password</span>
            <input
              type="password"
              required
              minLength={10}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-border px-4 py-2 transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full rounded-full bg-brand px-6 py-3 font-medium text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Updating..." : "Update password"}
          </button>
        </form>
        <Link href="/login" className="mt-6 inline-block text-sm text-brand underline">
          Back to login
        </Link>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}
