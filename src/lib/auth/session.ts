import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

export interface SessionUser {
  id: string;
  email: string;
  emailVerified: Date | null;
}

export async function getCurrentSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user) return null;

  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!dbUser) return null;
  if (dbUser.sessionVersion !== session.user.sessionVersion) return null;

  return { id: dbUser.id, email: dbUser.email, emailVerified: dbUser.emailVerified };
}
