import { redirect } from "next/navigation";
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
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-ink">Progress</h1>
      <p className="mb-8 text-sm text-ink-muted">How your actual study activity compares to what was planned.</p>
      <ProgressView initialWindow="week" initialData={data} streak={streak} />
    </div>
  );
}
