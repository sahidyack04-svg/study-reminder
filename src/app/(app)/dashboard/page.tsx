import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getDashboardBannerState } from "@/lib/dashboard/bannerState";
import { listTasks } from "@/lib/tasks/tasks";
import { getOrGeneratePlanForDate } from "@/lib/plan/planService";
import { getStreakStats } from "@/lib/progress/progressService";
import { getTodayEntry } from "@/lib/journal/journal";
import { todayInTimezone } from "@/lib/validation/age";
import { summarizeStreakCard } from "@/lib/progress/dashboardStreakCard";
import { computeAchievements } from "@/lib/progress/achievements";
import { AchievementCelebration } from "@/components/cosmic/AchievementCelebration";

interface PlanEntryRow {
  id: string;
  title: string;
  subjectId: string | null;
  estimatedMinutes: number;
  checkInStatus: string;
}

const CHECKIN_LABEL: Record<string, string> = {
  pending: "Not started",
  done: "Done",
  partial: "Partly done",
  not_done: "Not done",
};

export default async function DashboardPage() {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/login");

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
    include: { guardian: true, subjects: true },
  });
  if (!profile) redirect("/onboarding");

  const banner = getDashboardBannerState(profile.guardian);
  const subjectName = new Map(profile.subjects.map((s) => [s.id, s.name]));

  const tasks = await listTasks();
  const openTasks = tasks.filter((t) => t.status === "open");
  const today = todayInTimezone(profile.timezone);
  const overdueTasks = openTasks
    .filter((t) => t.dueDate && t.dueDate.getTime() < today.getTime())
    .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime());
  const upcomingTasks = openTasks
    .filter((t) => !t.dueDate || t.dueDate.getTime() >= today.getTime())
    .sort((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity))
    .slice(0, 5);

  const { entries: planEntriesRaw } = await getOrGeneratePlanForDate();
  const planEntries = planEntriesRaw as PlanEntryRow[];
  const planDoneCount = planEntries.filter((e) => e.checkInStatus === "done").length;

  const streakStats = await getStreakStats();
  const achievements = computeAchievements(streakStats.longest);
  const todayJournalEntry = await getTodayEntry();

  const todayLabel = today.toLocaleDateString(undefined, {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-col gap-8">
      {banner === "guardian-pending" && (
        <div className="rounded-xl border border-warning/30 bg-warning-light p-4 text-sm text-ink shadow-panel backdrop-blur-md">
          Waiting for your guardian ({profile.guardian?.email}) to approve your account.{" "}
          <Link href="/profile" className="font-medium text-warning underline underline-offset-2">Resend or update guardian info</Link>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-semibold text-ink">
          Welcome back, <span className="text-glow">{profile.name}</span>
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {todayLabel} · {profile.schoolName} · Grade {profile.grade} · {profile.curriculum}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatTile label="Today's plan" value={`${planDoneCount}/${planEntries.length}`} hint="items done" />
        <StatTile label="Open tasks" value={String(openTasks.length)} hint={overdueTasks.length > 0 ? `${overdueTasks.length} overdue` : "on track"} warn={overdueTasks.length > 0} />
        <StatTile label="Subjects" value={String(profile.subjects.length)} hint={profile.subjects.length === 1 ? "subject" : "subjects"} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card title="Today's schedule" action={{ href: "/plan", label: "Open full plan" }}>
            {planEntries.length === 0 ? (
              <EmptyState text="No study time set for today — add your weekly availability in Account to generate a plan." />
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {planEntries.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{entry.title}</p>
                      <p className="text-xs text-ink-muted">
                        {entry.subjectId ? subjectName.get(entry.subjectId) ?? "Subject" : "General"} · {entry.estimatedMinutes} min
                      </p>
                    </div>
                    <StatusBadge status={entry.checkInStatus} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Tasks & homework" action={{ href: "/tasks", label: "Manage tasks" }}>
            {overdueTasks.length === 0 && upcomingTasks.length === 0 ? (
              <EmptyState text="No open tasks — you're all caught up." />
            ) : (
              <div className="flex flex-col gap-4">
                {overdueTasks.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-danger">Overdue</p>
                    <ul className="flex flex-col divide-y divide-border">
                      {overdueTasks.map((t) => (
                        <TaskRow key={t.id} title={t.title} subject={t.subjectId ? subjectName.get(t.subjectId) : undefined} dueDate={t.dueDate} overdue />
                      ))}
                    </ul>
                  </div>
                )}
                {upcomingTasks.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Upcoming</p>
                    <ul className="flex flex-col divide-y divide-border">
                      {upcomingTasks.map((t) => (
                        <TaskRow key={t.id} title={t.title} subject={t.subjectId ? subjectName.get(t.subjectId) : undefined} dueDate={t.dueDate} />
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card title="Subjects" action={{ href: "/profile", label: "Edit" }}>
            {profile.subjects.length === 0 ? (
              <EmptyState text="No subjects yet — add your subjects in Account to start planning." />
            ) : (
              <ul className="flex flex-wrap gap-2">
                {profile.subjects.map((s) => (
                  <li key={s.id} className="rounded-full border border-brand/20 bg-brand-light px-3 py-1 text-sm text-brand">{s.name}</li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Progress" raised>
            <div className="relative flex flex-col gap-4">
              <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gold/10 blur-2xl" />

              <div
                className={`relative flex items-center gap-3 rounded-lg border border-border bg-cosmic-deep/40 px-4 py-3 ${
                  streakStats.current > 0 ? "animate-pulse-glow" : ""
                }`}
              >
                {streakStats.current > 0 && (
                  <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 shrink-0 text-gold" aria-hidden="true">
                    <path
                      d="M10 2c1 2.5-.5 3.5-1.5 5C7 8.5 6 10 6 12a4 4 0 0 0 8 0c0-1.2-.5-2-1-2.7.8 1.8-.2 3-1.2 3-1 0-1.3-.8-1-1.6.6-1.6-.2-2.8-1.4-4-.2 1 0 1.8-.4 2.3C8.4 9.4 8 10 8 11"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
                <p className="text-sm font-medium text-brand text-glow">{summarizeStreakCard(streakStats)}</p>
              </div>

              <div className="relative flex flex-col gap-2 text-xs text-ink-muted">
                <div>Longest streak: <span className="font-semibold text-ink">{streakStats.longest}</span> days</div>
                <div>Total active days: <span className="font-semibold text-ink">{streakStats.totalActiveDays}</span></div>
              </div>

              <div className="relative flex flex-wrap gap-2">
                {achievements.map((achievement) => (
                  <span
                    key={achievement.days}
                    title={achievement.unlocked ? `${achievement.days}-day streak unlocked` : `${achievement.days - streakStats.longest} more days to go`}
                    className={`glow-interactive rounded-full border px-2.5 py-1 text-xs font-medium transition hover:scale-105 ${
                      achievement.unlocked
                        ? "border-gold/30 bg-gold-light text-gold shadow-glow-gold"
                        : "border-border bg-surface text-ink-faint"
                    }`}
                  >
                    {achievement.days}d
                  </span>
                ))}
              </div>
            </div>
          </Card>

          <AchievementCelebration achievements={achievements} />

          <Card title="Journal" action={{ href: "/journal", label: todayJournalEntry ? "Edit entry" : "Write entry" }}>
            <p className="text-sm text-ink-muted">
              {todayJournalEntry ? "You've written in your journal today." : "You haven't written in your journal today yet."}
            </p>
          </Card>

          <Card title="Quick actions">
            <div className="flex flex-col gap-2">
              <Link href="/tasks" className="glow-interactive rounded-lg border border-border bg-cosmic-deep/40 px-3 py-2 text-sm font-medium text-ink hover:border-brand hover:text-brand">
                + Add a task
              </Link>
              <Link href="/journal" className="glow-interactive rounded-lg border border-border bg-cosmic-deep/40 px-3 py-2 text-sm font-medium text-ink hover:border-brand hover:text-brand">
                + Write in journal
              </Link>
              <Link href="/progress" className="glow-interactive rounded-lg border border-border bg-cosmic-deep/40 px-3 py-2 text-sm font-medium text-ink hover:border-brand hover:text-brand">
                View progress
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, hint, warn }: { label: string; value: string; hint: string; warn?: boolean }) {
  return (
    <div className="panel-cosmic glow-interactive p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-brand text-glow tabular-nums">{value}</p>
      <p className={`mt-0.5 text-xs ${warn ? "text-warning" : "text-ink-muted"}`}>{hint}</p>
    </div>
  );
}

function Card({
  title,
  action,
  raised,
  children,
}: {
  title: string;
  action?: { href: string; label: string };
  raised?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`${raised ? "panel-cosmic-raised" : "panel-cosmic"} p-5`}>
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-border pb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">{title}</h2>
        {action && (
          <Link
            href={action.href}
            className="glow-interactive rounded-md px-2 py-1 text-sm font-medium text-brand hover:underline"
          >
            {action.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-border bg-cosmic-deep/40 px-4 py-6 text-center text-sm text-ink-faint">
      {text}
    </p>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "border-border bg-cosmic-deep/40 text-ink-muted",
    done: "border-success/30 bg-success-light text-success",
    partial: "border-warning/30 bg-warning-light text-warning",
    not_done: "border-danger/30 bg-danger-light text-danger",
  };
  return (
    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${styles[status] ?? styles.pending}`}>
      {CHECKIN_LABEL[status] ?? status}
    </span>
  );
}

function TaskRow({
  title,
  subject,
  dueDate,
  overdue,
}: {
  title: string;
  subject?: string;
  dueDate: Date | null;
  overdue?: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink">{title}</p>
        <p className="text-xs text-ink-muted">{subject ?? "General"}</p>
      </div>
      {dueDate && (
        <span className={`shrink-0 text-xs font-medium tabular-nums ${overdue ? "text-danger" : "text-ink-muted"}`}>
          {dueDate.toLocaleDateString(undefined, { timeZone: "UTC", month: "short", day: "numeric" })}
        </span>
      )}
    </li>
  );
}
