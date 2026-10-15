"use server";

import { prisma } from "@/lib/db/prisma";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { requiresGuardianConsent, todayInTimezone } from "@/lib/validation/age";
import { requestGuardianConsent } from "./guardianConsent";

export interface ProfileEditableFields {
  name: string;
  dateOfBirth: string;
  grade: string;
  schoolName: string;
  curriculum: string;
  academicYear: string;
  gender?: string;
  timezone: string;
  guardian?: { name: string; email: string };
}

export async function updateStudentProfile(
  changes: Partial<ProfileEditableFields>,
): Promise<{ success: boolean; error?: string }> {
  // This is a reachable server action: never trust a client-supplied user id.
  // The owning user is resolved from the session before any work happens.
  const user = await getCurrentSessionUser();
  if (!user) {
    return { success: false, error: "You must be signed in to update your profile." };
  }

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
    include: { guardian: true },
  });
  if (!profile) {
    return { success: false, error: "Profile not found." };
  }

  const newDob = changes.dateOfBirth ? new Date(changes.dateOfBirth) : profile.dateOfBirth;
  // requiresGuardianConsent's default `asOf = new Date()` reads the host
  // process's instant, which is timezone-incorrect for determining "is today
  // the student's local calendar day." Evaluate in the student's own
  // declared timezone instead, the same way completeOnboarding does.
  const guardianNowRequired = requiresGuardianConsent(
    newDob,
    todayInTimezone(changes.timezone ?? profile.timezone),
  );

  const hasGuardianOnFile = !!profile.guardian;
  const guardianProvidedNow = !!changes.guardian;
  if (guardianNowRequired && !hasGuardianOnFile && !guardianProvidedNow) {
    return { success: false, error: "A guardian name and email are required for students under 18." };
  }

  const guardianInfoChanged =
    !!changes.guardian &&
    (changes.guardian.name !== profile.guardian?.name || changes.guardian.email !== profile.guardian?.email);

  await prisma.studentProfile.update({
    where: { userId: user.id },
    data: {
      ...(changes.name && { name: changes.name }),
      ...(changes.dateOfBirth && { dateOfBirth: newDob }),
      ...(changes.grade && { grade: changes.grade }),
      ...(changes.schoolName && { schoolName: changes.schoolName }),
      ...(changes.curriculum && { curriculum: changes.curriculum }),
      ...(changes.academicYear && { academicYear: changes.academicYear }),
      ...(changes.gender !== undefined && { gender: changes.gender }),
      ...(changes.timezone && { timezone: changes.timezone }),
    },
  });

  if (guardianNowRequired && changes.guardian && guardianInfoChanged) {
    await requestGuardianConsent(profile.id, changes.guardian);
  }

  return { success: true };
}
