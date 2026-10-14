"use server";

import { prisma } from "@/lib/db/prisma";
import { isTokenExpired } from "@/lib/validation/tokens";

export async function verifyEmailToken(token: string): Promise<{ success: boolean; error?: string }> {
  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record || record.purpose !== "email_verify") {
    return { success: false, error: "This verification link is invalid." };
  }

  if (isTokenExpired(record.expiresAt)) {
    await prisma.verificationToken.delete({ where: { token } });
    return { success: false, error: "This verification link has expired. Please request a new one." };
  }

  await prisma.user.update({ where: { id: record.userId }, data: { emailVerified: new Date() } });
  await prisma.verificationToken.delete({ where: { token } });
  return { success: true };
}
