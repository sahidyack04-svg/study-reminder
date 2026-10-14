import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { OnboardingWizard } from "./OnboardingWizard";

export default async function OnboardingPage() {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/login");

  const existingProfile = await prisma.studentProfile.findUnique({ where: { userId: user.id } });
  if (existingProfile) redirect("/dashboard");

  return <OnboardingWizard userId={user.id} />;
}
