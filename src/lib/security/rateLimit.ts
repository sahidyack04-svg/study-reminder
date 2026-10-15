import { prisma } from "@/lib/db/prisma";

export interface RateLimitOptions {
  action: string;
  identifier: string;
  maxAttempts: number;
  windowMs: number;
}

export async function checkRateLimit({
  action,
  identifier,
  maxAttempts,
  windowMs,
}: RateLimitOptions): Promise<{ allowed: boolean }> {
  const windowStart = new Date(Date.now() - windowMs);

  return prisma.$transaction(async (tx) => {
    const count = await tx.rateLimitAttempt.count({
      where: { action, identifier, createdAt: { gte: windowStart } },
    });

    if (count >= maxAttempts) {
      return { allowed: false };
    }

    await tx.rateLimitAttempt.create({ data: { action, identifier } });
    return { allowed: true };
  });
}
