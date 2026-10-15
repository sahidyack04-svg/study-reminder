"use server";

// The client-reachable guardian-consent surface, and nothing else.
//
// Everything exported from a "use server" file becomes an independently
// callable RPC endpoint, so only functions that are safe to expose directly
// to an unauthenticated (or arbitrary) caller belong here. In particular
// requestGuardianConsent deliberately stays in ./guardianConsent.ts, which
// has no directive: it takes a studentProfileId straight from its caller and
// returns the Guardian record including consentToken.

import { prisma } from "@/lib/db/prisma";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { requestGuardianConsent } from "./guardianConsent";

// Reached from the emailed consent link, so this one is intentionally
// unauthenticated — the unguessable token is the credential.
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

// Lets a signed-in student re-send the consent email to the guardian already
// on file, without having to change the guardian's name or email first. The
// student is resolved from the session, never from a caller-supplied id.
export async function resendGuardianConsentForCurrentUser(): Promise<{
  success: boolean;
  error?: string;
}> {
  const user = await getCurrentSessionUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
    include: { guardian: true },
  });
  if (!profile?.guardian) return { success: false, error: "No guardian is on file." };

  try {
    await requestGuardianConsent(profile.id, {
      name: profile.guardian.name,
      email: profile.guardian.email,
    });
    return { success: true };
  } catch {
    // requestGuardianConsent throws when its rate limit trips. This is a
    // client-reachable action, so surface a friendly result instead of
    // propagating an unhandled throw to the UI.
    return { success: false, error: "Too many consent requests sent recently. Please try again later." };
  }
}
