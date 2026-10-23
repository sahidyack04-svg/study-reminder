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
  const lockKey = `${action}:${identifier}`;

  return prisma.$transaction(async (tx) => {
    // Postgres's default READ COMMITTED isolation lets concurrent
    // transactions all read the same pre-write count, so a plain
    // count-then-create race allows far more than maxAttempts through
    // under concurrency (unlike SQLite, which serializes writes at the
    // file level and incidentally hid this race). A transaction-scoped
    // advisory lock keyed by action+identifier serializes only the calls
    // that share this rate-limit key -- it blocks concurrent callers here
    // rather than letting them read stale state, and releases
    // automatically when the transaction commits or rolls back.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

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
