"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { validatePassword } from "@/lib/validation/password";
import { generateToken, hashToken, tokenExpiryDate, isTokenExpired } from "@/lib/validation/tokens";
import { sendEmail } from "@/lib/email/send";
import { revokeAllSessions } from "@/lib/auth/revokeSessions";
import { checkRateLimit } from "@/lib/security/rateLimit";

export async function requestPasswordReset(email: string): Promise<{ success: boolean }> {
  const rateLimit = await checkRateLimit({
    action: "password_reset",
    identifier: email,
    maxAttempts: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return { success: true }; // still don't reveal anything; just silently skip sending
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const token = generateToken();
    await prisma.verificationToken.create({
      data: { token: hashToken(token), userId: user.id, purpose: "password_reset", expiresAt: tokenExpiryDate(1) },
    });
    await sendEmail({
      to: email,
      subject: "Reset your Study Reminder password",
      body: `Reset your password here: ${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`,
    });
  }
  return { success: true };
}

export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  const tokenHash = hashToken(token);
  const record = await prisma.verificationToken.findUnique({ where: { token: tokenHash } });
  if (!record || record.purpose !== "password_reset" || isTokenExpired(record.expiresAt)) {
    if (record) await prisma.verificationToken.delete({ where: { token: tokenHash } });
    return { success: false, error: "This reset link is invalid or has expired." };
  }

  const passwordCheck = validatePassword(newPassword);
  if (!passwordCheck.valid) {
    return { success: false, error: passwordCheck.reason };
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: record.userId }, data: { passwordHash } });
  await revokeAllSessions(record.userId);
  await prisma.verificationToken.delete({ where: { token: tokenHash } });
  return { success: true };
}
