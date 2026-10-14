import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getDashboardBannerState } from "@/lib/dashboard/bannerState";

export default async function DashboardPage() {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/login");

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
    include: { guardian: true, subjects: true },
  });
  if (!profile) redirect("/onboarding");

  const banner = getDashboardBannerState(profile.guardian);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      {banner === "guardian-pending" && (
        <div className="mb-6 rounded-xl bg-blush p-4 text-sm text-slate-700">
          Waiting for your guardian ({profile.guardian?.email}) to approve your account.{" "}
          <Link href="/profile" className="underline">Resend or update guardian info</Link>
        </div>
      )}

      <h1 className="mb-2 text-3xl font-semibold text-pink-dark">Hi {profile.name} 👋</h1>
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

      {(["Study plan", "Homework & tasks", "Daily check-in", "Progress reports"] as const).map((label) => (
        <section key={label} className="mb-4 rounded-xl border border-dashed border-lavender p-6 text-slate-500">
          {label} is coming in a later phase.
        </section>
      ))}
    </main>
  );
}
