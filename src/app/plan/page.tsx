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
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mb-8 text-2xl font-semibold text-pink-dark">Today&apos;s plan</h1>
      <PlanView entries={entries as any} capacityMinutes={capacityMinutes} />
    </main>
  );
}
