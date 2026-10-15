"use client";

import { useState } from "react";
import { requestPasswordReset } from "@/lib/auth/passwordReset";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await requestPasswordReset(email);
    } catch {
      // requestPasswordReset never throws, but guard against a genuine
      // client-side network failure reaching the server action.
    }
    setSent(true);
  }

  if (sent) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <p className="text-slate-600">
          If an account exists for <strong>{email}</strong>, we&apos;ve sent a password reset link.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-24">
      <h1 className="mb-8 text-2xl font-semibold text-pink-dark">Reset your password</h1>
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
        <button
          type="submit"
          className="mt-2 rounded-full bg-pink px-6 py-3 font-medium text-white hover:bg-pink-dark"
        >
          Send reset link
        </button>
      </form>
    </main>
  );
}
