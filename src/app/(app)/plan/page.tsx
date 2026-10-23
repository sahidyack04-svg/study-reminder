import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getOrGeneratePlanForDate } from "@/lib/plan/planService";
import { PlanView } from "./PlanView";

export default async function PlanPage() {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/login");

  const profile = await prisma.studentProfile.findUnique({ where: { userId: user.id } });
  if (!profile) redirect("/onboarding");

  const { entries, capacityMinutes } = await getOrGeneratePlanForDate();

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-ink">Today&apos;s plan</h1>
      <p className="mb-8 text-sm text-ink-muted">Your study blocks for today, generated from your availability and open work.</p>
      <PlanView entries={entries as any} capacityMinutes={capacityMinutes} />
    </div>
  );
}
