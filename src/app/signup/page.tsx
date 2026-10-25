"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { signupStudent } from "@/lib/auth/signup";
import { Starfield } from "@/components/cosmic/Starfield";
import { Logo } from "@/components/cosmic/Logo";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

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
      if (!result.success) {
        setStatus("error");
        setError(result.error ?? "Something went wrong. Please try again.");
        return;
      }

      // No email verification step - sign the new account in immediately.
      const signInResult = await signIn("credentials", { email, password, redirect: false });
      if (signInResult?.error) {
        // Account was created but the automatic sign-in failed for some other reason
        // (e.g. a rate limit) - send them to login rather than leaving them stuck.
        router.push("/login");
        return;
      }
      router.push("/dashboard");
    } catch {
      setStatus("error");
      setError("Something went wrong. Please try again.");
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-16">
      <Starfield intensity="ambient" />
      <div className="relative w-full max-w-md">
        <div aria-hidden="true" className="absolute -inset-10 -z-10 rounded-full bg-brand/10 blur-3xl" />
        <div className="panel-cosmic-raised relative animate-fade-up overflow-hidden p-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
          />
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-violet/15 blur-2xl" />
          <Link href="/" className="glow-interactive relative mb-6 flex w-fit items-center gap-2 rounded-lg">
            <Logo size={28} />
          </Link>
          <h1 className="relative mb-1 text-2xl font-semibold text-ink text-glow">Create your account</h1>
          <p className="mb-6 text-sm text-ink-muted">Start planning your study routine in minutes.</p>
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
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-ink">Password</span>
              <input
                type="password"
                required
                minLength={10}
                autoComplete="new-password"
                value={password}
                onChange={handlePasswordChange}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-ink">Confirm password</span>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={handleConfirmPasswordChange}
                aria-invalid={!!error}
                aria-describedby={error ? "password-match-error" : undefined}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
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
              className="glow-interactive mt-2 w-full rounded-lg bg-brand px-4 py-2 font-semibold text-cosmic-void shadow-glow transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "submitting" ? "Creating account..." : "Create account"}
            </button>
          </form>
          <p className="relative mt-6 text-sm text-ink-muted">
            Already have an account? <Link href="/login" className="font-medium text-brand underline underline-offset-2 transition hover:text-brand-dark">Sign in</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
