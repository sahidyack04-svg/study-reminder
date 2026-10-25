import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { checkRateLimit } from "@/lib/security/rateLimit";

export async function verifyCredentials(
  email: string,
  password: string,
): Promise<{ id: string; email: string } | null> {
  // Returning null (identical to "invalid credentials") keeps the login
  // page's generic error message and doesn't reveal that rate limiting
  // specifically triggered.
  const rateLimit = await checkRateLimit({
    action: "login",
    identifier: email,
    maxAttempts: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!rateLimit.allowed) return null;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  return { id: user.id, email: user.email };
}
