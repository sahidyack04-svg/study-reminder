import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ProfileEditForm } from "./ProfileEditForm";

export default async function ProfilePage() {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/login");

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
    include: { guardian: true },
  });
  if (!profile) redirect("/onboarding");

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mb-8 text-2xl font-semibold text-pink-dark">Your profile</h1>
      <ProfileEditForm
        userId={user.id}
        initial={{
          name: profile.name,
          dateOfBirth: profile.dateOfBirth.toISOString().slice(0, 10),
          grade: profile.grade,
          schoolName: profile.schoolName,
          curriculum: profile.curriculum,
          academicYear: profile.academicYear,
          gender: profile.gender ?? undefined,
          timezone: profile.timezone,
          guardian: profile.guardian ? { name: profile.guardian.name, email: profile.guardian.email } : undefined,
        }}
        guardianStatus={
          profile.guardian
            ? { email: profile.guardian.email, approved: !!profile.guardian.consentGivenAt }
            : null
        }
      />
    </main>
  );
}
