import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { listTasks } from "@/lib/tasks/tasks";
import { TaskList } from "./TaskList";

export default async function TasksPage() {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/login");

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
    include: { subjects: true },
  });
  if (!profile) redirect("/onboarding");

  const tasks = await listTasks();

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-ink">Tasks &amp; homework</h1>
      <p className="mb-8 text-sm text-ink-muted">Keep on top of what's due and mark work off as you finish it.</p>
      <TaskList initialTasks={tasks} subjects={profile.subjects} />
    </div>
  );
}
