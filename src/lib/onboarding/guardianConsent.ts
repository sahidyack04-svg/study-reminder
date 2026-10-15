// NOTE: there is deliberately NO "use server" directive in this file.
//
// A file-level directive would turn EVERY export here into an independently
// reachable RPC endpoint — including requestGuardianConsent, which is only
// ever called by other server-side code and returns the full Guardian record
// (consentToken included). A client could otherwise POST to it directly with
// an arbitrary studentProfileId and read back another student's consent token.
//
// The functions that genuinely need to be callable from a client component
// live in ./guardianConsentActions.ts, which is the single "use server"
// boundary. (A function-level "use server" directive can't be used here:
// Next.js rejects inline server actions in any module reachable from a client
// component, and this module is in ProfileEditForm's import graph.)

import { prisma } from "@/lib/db/prisma";
import { generateToken } from "@/lib/validation/tokens";
import { sendEmail } from "@/lib/email/send";
import { checkRateLimit } from "@/lib/security/rateLimit";

export async function requestGuardianConsent(
  studentProfileId: string,
  guardian: { name: string; email: string },
) {
  const rateLimit = await checkRateLimit({
    action: "guardian_consent",
    identifier: studentProfileId,
    maxAttempts: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!rateLimit.allowed) {
    throw new Error("Too many consent requests sent recently. Please try again later.");
  }

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
