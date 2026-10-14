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
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="mb-4 text-2xl font-semibold text-pink-dark">Check your email</h1>
        <p className="text-slate-600">
          We&apos;ve sent a verification link to <strong>{email}</strong>. Click it to activate your account.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-24">
      <h1 className="mb-8 text-2xl font-semibold text-pink-dark">Create your account</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-700">Password</span>
          <input
            type="password"
            required
            minLength={10}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-lavender px-4 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-700">Confirm password</span>
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="rounded-lg border border-lavender px-4 py-2"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={status === "submitting"}
          className="mt-2 rounded-full bg-pink px-6 py-3 font-medium text-white hover:bg-pink-dark disabled:opacity-60"
        >
          {status === "submitting" ? "Creating account..." : "Sign up"}
        </button>
      </form>
      <p className="mt-6 text-sm text-slate-500">
        Already have an account? <Link href="/login" className="text-lavender-dark underline">Log in</Link>
      </p>
    </main>
  );
}
