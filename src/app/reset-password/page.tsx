"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { resetPassword } from "@/lib/auth/passwordReset";
import { Starfield } from "@/components/cosmic/Starfield";
import { Logo } from "@/components/cosmic/Logo";

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
      <main className="flex min-h-screen items-center justify-center px-4 py-16">
        <Starfield intensity="ambient" />
        <div className="panel-cosmic-raised w-full max-w-md animate-burst-in p-8 text-center">
          <Logo size={28} className="mx-auto mb-6 w-fit" />
          <h1 className="text-glow mb-3 text-2xl font-semibold text-brand">Password updated</h1>
          <p className="text-ink-muted">Redirecting you to login...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <Starfield intensity="ambient" />
      <div className="panel-cosmic-raised w-full max-w-md animate-fade-up p-8">
        <Logo size={28} className="mb-6 w-fit" />
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
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="glow-interactive mt-2 w-full rounded-lg bg-brand px-4 py-2 font-semibold text-cosmic-void shadow-glow transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Updating..." : "Update password"}
          </button>
        </form>
        <Link href="/login" className="mt-6 inline-block text-sm text-brand underline underline-offset-2 transition hover:text-brand-dark">
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
