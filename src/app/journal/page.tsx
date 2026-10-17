import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getTodayEntry, listPastEntries } from "@/lib/journal/journal";
import { JournalView } from "./JournalView";

export default async function JournalPage() {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/login");

  const profile = await prisma.studentProfile.findUnique({ where: { userId: user.id } });
  if (!profile) redirect("/onboarding");

  const [todayEntry, pastEntries] = await Promise.all([getTodayEntry(), listPastEntries()]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link href="/dashboard" className="mb-4 inline-block text-sm text-lavender-dark underline">
        ← Back to dashboard
      </Link>
      <h1 className="mb-8 text-2xl font-semibold text-pink-dark">Your journal</h1>
      <JournalView todayEntry={todayEntry} pastEntries={pastEntries} />
    </main>
  );
}
