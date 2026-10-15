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
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mb-8 text-2xl font-semibold text-pink-dark">Your tasks</h1>
      <TaskList initialTasks={tasks} subjects={profile.subjects} />
    </main>
  );
}
