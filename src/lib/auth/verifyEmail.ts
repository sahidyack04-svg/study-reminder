"use server";

import { prisma } from "@/lib/db/prisma";
import { generateToken, hashToken, isTokenExpired, tokenExpiryDate } from "@/lib/validation/tokens";
import { sendEmail } from "@/lib/email/send";
import { checkRateLimit } from "@/lib/security/rateLimit";

export async function verifyEmailToken(token: string): Promise<{ success: boolean; error?: string }> {
  const tokenHash = hashToken(token);
  const record = await prisma.verificationToken.findUnique({ where: { token: tokenHash } });
  if (!record || record.purpose !== "email_verify") {
    return { success: false, error: "This verification link is invalid." };
  }

  if (isTokenExpired(record.expiresAt)) {
    await prisma.verificationToken.delete({ where: { token: tokenHash } });
    return { success: false, error: "This verification link has expired. Please request a new one." };
  }

  await prisma.user.update({ where: { id: record.userId }, data: { emailVerified: new Date() } });
  await prisma.verificationToken.delete({ where: { token: tokenHash } });
  return { success: true };
}

// Mirrors requestPasswordReset's no-enumeration pattern: always report
// success, and only actually send when the account exists and is still
// unverified. Any existing unexpired token is left alone — multiple valid
// tokens for the same purpose can coexist safely.
export async function resendVerificationEmail(email: string): Promise<{ success: boolean }> {
  const rateLimit = await checkRateLimit({
    action: "resend_verification",
    identifier: email,
    maxAttempts: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return { success: true };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (user && !user.emailVerified) {
    const token = generateToken();
    await prisma.verificationToken.create({
      data: { token: hashToken(token), userId: user.id, purpose: "email_verify", expiresAt: tokenExpiryDate(24) },
    });
    await sendEmail({
      to: email,
      subject: "Verify your Study Reminder account",
      body: `Verify your email here: ${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=${token}`,
    });
  }
  return { success: true };
}
