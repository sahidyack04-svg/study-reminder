import Link from "next/link";
import { verifyEmailToken } from "@/lib/auth/verifyEmail";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <p className="text-slate-600">Check your email for a verification link to activate your account.</p>
      </main>
    );
  }

  const result = await verifyEmailToken(token);

  return (
    <main className="mx-auto max-w-md px-6 py-24 text-center">
      {result.success ? (
        <>
          <h1 className="mb-4 text-2xl font-semibold text-pink-dark">Email verified!</h1>
          <Link href="/login" className="text-lavender-dark underline">
            Log in to continue
          </Link>
        </>
      ) : (
        <>
          <h1 className="mb-4 text-2xl font-semibold text-pink-dark">Verification failed</h1>
          <p className="text-slate-600">{result.error}</p>
        </>
      )}
    </main>
  );
}
