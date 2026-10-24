import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ProfileEditForm } from "./ProfileEditForm";
import { NotificationPreferencesForm } from "./NotificationPreferencesForm";
import { getPreferences, type PreferencesView } from "@/lib/notifications/preferences";

const DEFAULT_PREFERENCES: PreferencesView = {
  channel: "none",
  preferredTimes: [],
  phone: null,
  quietHoursStart: null,
  quietHoursEnd: null,
  whatsappConsentGiven: false,
};

export default async function ProfilePage() {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/login");

  const [profile, preferences] = await Promise.all([
    prisma.studentProfile.findUnique({
      where: { userId: user.id },
      include: { guardian: true },
    }),
    getPreferences(),
  ]);
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
      <div className="mt-8">
        <NotificationPreferencesForm initial={preferences ?? DEFAULT_PREFERENCES} />
      </div>
    </div>
  );
}
