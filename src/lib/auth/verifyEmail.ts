"use server";

import { prisma } from "@/lib/db/prisma";
import { generateToken, hashToken, isTokenExpired, tokenExpiryDate } from "@/lib/validation/tokens";
import { sendEmail } from "@/lib/email/send";
import { buildEmailVerificationEmail } from "@/lib/email/templates/emailVerification";
import { checkRateLimit } from "@/lib/security/rateLimit";

const VERIFY_TOKEN_EXPIRY_HOURS = 24;

// Single-use: the token row is deleted on every outcome (success, expired, or
// wrong purpose) so it can never be replayed, mirroring resetPassword's pattern.
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
// unverified. Any existing unexpired token is left alone -- multiple valid
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

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && !user.emailVerified) {
      const token = generateToken();
      await prisma.verificationToken.create({
        data: {
          token: hashToken(token),
          userId: user.id,
          purpose: "email_verify",
          expiresAt: tokenExpiryDate(VERIFY_TOKEN_EXPIRY_HOURS),
        },
      });
      const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=${token}`;
      const { subject, html, text } = buildEmailVerificationEmail({
        verifyUrl,
        expiryHours: VERIFY_TOKEN_EXPIRY_HOURS,
      });
      await sendEmail({ to: email, subject, body: text, html });
    }
  } catch (err) {
    console.error("[resendVerificationEmail] failed to process resend request:", err);
  }
  return { success: true };
}
