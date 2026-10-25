"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Starfield } from "@/components/cosmic/Starfield";
import { Logo } from "@/components/cosmic/Logo";

const BENEFITS = [
  { icon: IconChart, text: "Track your progress" },
  { icon: IconHabit, text: "Build better habits" },
  { icon: IconTarget, text: "Reach your goals" },
  { icon: IconSunrise, text: "A brighter future awaits" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

  // Clear a stale error as soon as the student starts correcting their credentials,
  // rather than leaving a failed-attempt message lingering until the next submit.
  function handleEmailChange(value: string) {
    setEmail(value);
    if (error) setError(null);
  }
  function handlePasswordChange(value: string) {
    setPassword(value);
    if (error) setError(null);
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12 lg:px-10">
      <Starfield intensity="ambient" />

      <div className="relative grid w-full max-w-6xl gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
        {/* Branding column */}
        <div className="animate-fade-up flex flex-col items-center text-center lg:items-start lg:text-left">
          <Link href="/" className="glow-interactive mb-6 rounded-lg">
            <Logo size={40} />
          </Link>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-brand">Plan • Focus • Achieve</p>
          <h1 className="mb-4 max-w-md text-3xl font-semibold leading-tight text-ink text-glow lg:text-4xl">
            Small steps every day lead to big dreams tomorrow.
          </h1>
          <ul className="mt-2 grid w-full max-w-sm grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-md">
            {BENEFITS.map(({ icon: Icon, text }) => (
              <li
                key={text}
                className="glow-interactive flex items-center gap-2 rounded-lg border border-border bg-surface/60 px-3 py-2.5 text-sm text-ink-muted backdrop-blur-sm"
              >
                <Icon className="h-4 w-4 shrink-0 text-brand" />
                {text}
              </li>
            ))}
          </ul>
        </div>

        {/* Auth card */}
        <div className="relative mx-auto w-full max-w-md">
          <div aria-hidden="true" className="absolute -inset-10 -z-10 rounded-full bg-brand/10 blur-3xl" />
          <div className="panel-cosmic-raised relative animate-fade-up overflow-hidden p-8 [animation-delay:100ms]">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-violet/15 blur-2xl"
            />

            <Logo size={28} className="relative mb-6 w-fit" />
            <h2 className="relative mb-1 text-2xl font-semibold text-ink">Welcome back</h2>
            <p className="relative mb-6 text-sm text-ink-muted">Sign in to continue your mission.</p>
            <form onSubmit={handleSubmit} className="relative flex flex-col gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-ink">Email</span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-ink">Password</span>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 pr-10 text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    className="glow-interactive absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-ink-muted hover:text-brand"
                  >
                    {showPassword ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
                  </button>
                </div>
              </label>
              {error && (
                <p role="alert" className="rounded-lg border border-danger/30 bg-danger-light px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="glow-interactive mt-2 w-full rounded-lg bg-gradient-to-r from-brand via-brand to-violet bg-[length:200%_100%] bg-left px-4 py-2 font-semibold text-cosmic-void shadow-glow transition-all duration-500 hover:bg-right disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Signing in..." : "Sign in"}
              </button>
            </form>
            <p className="relative mt-6 text-sm text-ink-muted">
              <Link href="/forgot-password" className="font-medium text-brand underline underline-offset-2 transition hover:text-brand-dark">Forgot your password?</Link>
            </p>
            <p className="relative mt-2 text-sm text-ink-muted">
              Don&apos;t have an account? <Link href="/signup" className="font-medium text-brand underline underline-offset-2 transition hover:text-brand-dark">Create one</Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function IconChart({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M3 17V3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M3 17h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M5.5 14l3-3.5 2.5 2 4-5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconHabit({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M3.5 5.5l1.5 1.5 2.5-2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 5h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M3.5 10.5l1.5 1.5 2.5-2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 10h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M3.5 15.5l1.5 1.5 2.5-2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 15h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconTarget({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="10" cy="10" r="0.8" fill="currentColor" />
    </svg>
  );
}

function IconSunrise({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M5 13a5 5 0 0 1 10 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M2.5 13h15M10 3v2.5M4 7l1.5 1.5M16 7l-1.5 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M3.5 16h13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconEye({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M1.5 10S4.5 4.5 10 4.5 18.5 10 18.5 10 15.5 15.5 10 15.5 1.5 10 1.5 10Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconEyeOff({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="M2.5 2.5l15 15M8.2 8.3a2.5 2.5 0 0 0 3.5 3.5M5.4 5.5C3.3 6.9 1.5 10 1.5 10s3 5.5 8.5 5.5c1.4 0 2.6-.3 3.7-.9M15.8 13.6c1.6-1.4 2.7-3.6 2.7-3.6s-3-5.5-8.5-5.5c-.7 0-1.4.1-2 .2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
