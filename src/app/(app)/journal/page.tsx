import { redirect } from "next/navigation";
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
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-ink">Journal</h1>
      <p className="mb-8 text-sm text-ink-muted">A private, dated record of how your studying is actually going.</p>
      <JournalView todayEntry={todayEntry} pastEntries={pastEntries} />
    </div>
  );
}
