"use server";

import { prisma } from "@/lib/db/prisma";
import { generateToken } from "@/lib/validation/tokens";
import { sendEmail } from "@/lib/email/send";

export async function requestGuardianConsent(
  studentProfileId: string,
  guardian: { name: string; email: string },
) {
  const token = generateToken();
  const record = await prisma.guardian.upsert({
    where: { studentProfileId },
    update: {
      name: guardian.name,
      email: guardian.email,
      consentToken: token,
      consentRequestedAt: new Date(),
      consentGivenAt: null,
    },
    create: { studentProfileId, name: guardian.name, email: guardian.email, consentToken: token },
  });

  await sendEmail({
    to: guardian.email,
    subject: "Approve your student's Study Reminder account",
    body: `Your student added you as their guardian. Approve here: ${process.env.NEXT_PUBLIC_APP_URL}/guardian-consent/${token}`,
  });

  return record;
}

export async function approveGuardianConsent(
  token: string,
): Promise<{ success: boolean; error?: string; alreadyApproved?: boolean }> {
  const guardian = await prisma.guardian.findUnique({ where: { consentToken: token } });
  if (!guardian) {
    return { success: false, error: "This consent link is invalid." };
  }
  if (guardian.consentGivenAt) {
    return { success: true, alreadyApproved: true };
  }

  await prisma.guardian.update({ where: { id: guardian.id }, data: { consentGivenAt: new Date() } });
  return { success: true };
}
