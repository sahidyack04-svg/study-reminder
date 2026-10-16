import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getDashboardBannerState } from "@/lib/dashboard/bannerState";
import { listTasks } from "@/lib/tasks/tasks";
import { getOrGeneratePlanForDate } from "@/lib/plan/planService";
import { SignOutButton } from "./SignOutButton";

export default async function DashboardPage() {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/login");

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
    include: { guardian: true, subjects: true },
  });
  if (!profile) redirect("/onboarding");

  const banner = getDashboardBannerState(profile.guardian);

  const tasks = await listTasks();
  const openTaskCount = tasks.filter((t) => t.status === "open").length;
  const { entries: planEntries } = await getOrGeneratePlanForDate();
  const planEntryCount = planEntries.length;
  const planDoneCount = (planEntries as { checkInStatus: string }[]).filter((e) => e.checkInStatus === "done").length;

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      {banner === "guardian-pending" && (
        <div className="mb-6 rounded-xl bg-blush p-4 text-sm text-slate-700">
          Waiting for your guardian ({profile.guardian?.email}) to approve your account.{" "}
          <Link href="/profile" className="underline">Resend or update guardian info</Link>
        </div>
      )}

      <div className="mb-2 flex items-start justify-between gap-4">
        <h1 className="text-3xl font-semibold text-pink-dark">Hi {profile.name} 👋</h1>
        <SignOutButton />
      </div>
      <p className="mb-8 text-slate-600">
        {profile.schoolName} · Grade {profile.grade} · {profile.curriculum}
      </p>

      <section className="mb-8 rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-medium text-lavender-dark">Your subjects</h2>
        <ul className="flex flex-wrap gap-2">
          {profile.subjects.map((s) => (
            <li key={s.id} className="rounded-full bg-blush px-3 py-1 text-sm">{s.name}</li>
          ))}
        </ul>
      </section>

      <section className="mb-4 rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-medium text-lavender-dark">Today&apos;s plan</h2>
        <p className="text-slate-600">
          {planEntryCount === 0
            ? "No study time set for today — check your availability in your profile."
            : `${planDoneCount} of ${planEntryCount} items done.`}
        </p>
        <Link href="/plan" className="mt-2 inline-block text-sm text-lavender-dark underline">
          View today&apos;s plan
        </Link>
      </section>

      <section className="mb-4 rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-medium text-lavender-dark">Homework &amp; tasks</h2>
        <p className="text-slate-600">{openTaskCount} open task{openTaskCount === 1 ? "" : "s"}.</p>
        <Link href="/tasks" className="mt-2 inline-block text-sm text-lavender-dark underline">
          Manage tasks
        </Link>
      </section>

      <section className="mb-4 rounded-xl border border-dashed border-lavender p-6 text-slate-500">
        Progress reports is coming in a later phase.
      </section>
    </main>
  );
}
