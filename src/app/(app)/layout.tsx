import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { AppShell } from "./AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/login");

  const profile = await prisma.studentProfile.findUnique({ where: { userId: user.id } });
  if (!profile) redirect("/onboarding");

  return <AppShell studentName={profile.name}>{children}</AppShell>;
}
