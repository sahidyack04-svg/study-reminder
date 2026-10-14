"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { validatePassword } from "@/lib/validation/password";
import { generateToken, tokenExpiryDate } from "@/lib/validation/tokens";
import { sendEmail } from "@/lib/email/send";

export interface SignupInput {
  email: string;
  password: string;
}

export interface SignupResult {
  success: boolean;
  error?: string;
}

export async function signupStudent({ email, password }: SignupInput): Promise<SignupResult> {
  const passwordCheck = validatePassword(password);
  if (!passwordCheck.valid) {
    return { success: false, error: passwordCheck.reason };
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return { success: false, error: "An account with this email already exists." };
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({ data: { email, passwordHash } });

    const token = generateToken();
    await prisma.verificationToken.create({
      data: { token, userId: user.id, purpose: "email_verify", expiresAt: tokenExpiryDate(24) },
    });

    await sendEmail({
      to: email,
      subject: "Verify your Study Reminder account",
      body: `Welcome to Study Reminder! Verify your email here: ${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=${token}`,
    });

    return { success: true };
  } catch {
    return { success: false, error: "Something went wrong. Please try again." };
  }
}
