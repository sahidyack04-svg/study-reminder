"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { validatePassword } from "@/lib/validation/password";
import { generateToken, hashToken, tokenExpiryDate } from "@/lib/validation/tokens";
import { sendEmail } from "@/lib/email/send";
import { buildEmailVerificationEmail } from "@/lib/email/templates/emailVerification";
import { checkRateLimit } from "@/lib/security/rateLimit";

const VERIFY_TOKEN_EXPIRY_HOURS = 24;

export interface SignupInput {
  email: string;
  password: string;
}

export interface SignupResult {
  success: boolean;
  error?: string;
  emailDelivered?: boolean;
}

export async function signupStudent({ email, password }: SignupInput): Promise<SignupResult> {
  const passwordCheck = validatePassword(password);
  if (!passwordCheck.valid) {
    return { success: false, error: passwordCheck.reason };
  }

  const rateLimit = await checkRateLimit({
    action: "signup",
    identifier: email,
    maxAttempts: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return { success: false, error: "Too many signup attempts. Please try again later." };
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
    const emailResult = await sendEmail({ to: email, subject, body: text, html });

    return { success: true, emailDelivered: emailResult.delivered };
  } catch {
    return { success: false, error: "Something went wrong. Please try again." };
  }
}
