import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { listQuestions } from "@/lib/questions/questions";
import type { QuestionView } from "@/lib/questions/questions";
import { QuestionBankView } from "./QuestionBankView";

export default async function QuestionsPage() {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/login");

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
  });
  if (!profile) redirect("/onboarding");

  const subjects = await prisma.subject.findMany({
    where: { studentProfileId: profile.id },
  });

  const initialQuestions: Record<string, QuestionView[]> = {};
  for (const subject of subjects) {
    initialQuestions[subject.id] = await listQuestions(subject.id);
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-ink">Question bank</h1>
      <p className="mb-8 text-sm text-ink-muted">
        Build a bank of questions per subject — your self-check tests are generated from these.
      </p>
      <QuestionBankView
        subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
        initialQuestions={initialQuestions}
      />
    </div>
  );
}
