import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { OnboardingWizard } from "./OnboardingWizard";

export default async function OnboardingPage() {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/login");

  return <OnboardingWizard userId={user.id} />;
}
