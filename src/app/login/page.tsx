"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await signIn("credentials", { email, password, redirect: false });

    if (result?.error) {
      setError("Invalid email or password, or your email isn't verified yet.");
      setSubmitting(false);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-page px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-border bg-white p-8 shadow-sm">
        <Link href="/" className="mb-6 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-xs font-bold text-white">SR</span>
          <span className="text-sm font-semibold text-ink">Study Reminder</span>
        </Link>
        <h1 className="mb-1 text-2xl font-semibold text-ink">Sign in</h1>
        <p className="mb-6 text-sm text-ink-muted">Welcome back. Enter your details to continue.</p>
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-border px-4 py-2 transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full rounded-full bg-brand px-6 py-3 font-medium text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p className="mt-6 text-sm text-ink-muted">
          <Link href="/forgot-password" className="font-medium text-brand underline">Forgot your password?</Link>
        </p>
        <p className="mt-2 text-sm text-ink-muted">
          Don&apos;t have an account? <Link href="/signup" className="font-medium text-brand underline">Create one</Link>
        </p>
      </div>
    </main>
  );
}
