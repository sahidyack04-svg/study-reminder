import { redirect, notFound } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { getTest } from "@/lib/assessments/testService";
import { TestTakingView } from "./TestTakingView";

export default async function TestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getCurrentSessionUser();
  if (!user) redirect("/login");

  const test = await getTest(id);
  if (!test) notFound();

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-ink">{test.subjectName} test</h1>
      <p className="mb-8 text-sm text-ink-muted">
        {test.status === "completed" ? "Review your answers below." : "Answer every question, then submit."}
      </p>
      <TestTakingView test={test} />
    </div>
  );
}
