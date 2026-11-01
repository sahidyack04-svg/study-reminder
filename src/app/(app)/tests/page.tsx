import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { listTests, getWeakTopics } from "@/lib/assessments/testService";
import { TestsView } from "./TestsView";

export default async function TestsPage() {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/login");

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
  });
  if (!profile) redirect("/onboarding");

  const subjects = await prisma.subject.findMany({
    where: { studentProfileId: profile.id },
  });

  const [tests, weakTopics] = await Promise.all([listTests(), getWeakTopics()]);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-ink">Monthly tests</h1>
      <p className="mb-8 text-sm text-ink-muted">
        Self-check your progress with a randomly-generated test from your question bank.
      </p>
      <TestsView
        subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
        initialTests={tests}
        weakTopics={weakTopics}
      />
    </div>
  );
}
