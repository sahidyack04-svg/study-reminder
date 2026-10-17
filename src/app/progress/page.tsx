import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getProgressData, getCurrentStreak } from "@/lib/progress/progressService";
import { ProgressView } from "./ProgressView";

export default async function ProgressPage() {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/login");

  const profile = await prisma.studentProfile.findUnique({ where: { userId: user.id } });
  if (!profile) redirect("/onboarding");

  const [data, streak] = await Promise.all([getProgressData("week"), getCurrentStreak()]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link href="/dashboard" className="mb-4 inline-block text-sm text-lavender-dark underline">
        ← Back to dashboard
      </Link>
      <h1 className="mb-8 text-2xl font-semibold text-pink-dark">Your progress</h1>
      <ProgressView initialWindow="week" initialData={data} streak={streak} />
    </main>
  );
}
