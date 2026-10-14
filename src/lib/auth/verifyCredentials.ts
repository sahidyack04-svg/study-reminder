import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";

export async function verifyCredentials(
  email: string,
  password: string,
): Promise<{ id: string; email: string } | null> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.emailVerified) return null;

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  return { id: user.id, email: user.email };
}
