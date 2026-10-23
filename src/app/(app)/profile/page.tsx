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
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-ink">Account</h1>
      <p className="mb-8 text-sm text-ink-muted">Your profile, availability, and guardian details.</p>
      <ProfileEditForm
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
    </div>
  );
}
