import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { checkRateLimit } from "@/lib/security/rateLimit";

describe("checkRateLimit", () => {
  const identifier = `rl-test-${Date.now()}@example.test`;

  afterEach(async () => {
    await prisma.rateLimitAttempt.deleteMany({ where: { identifier } });
  });

  it("allows attempts up to the max, then blocks the next one", async () => {
    const options = { action: "signup", identifier, maxAttempts: 3, windowMs: 60_000 };
    expect((await checkRateLimit(options)).allowed).toBe(true);
    expect((await checkRateLimit(options)).allowed).toBe(true);
    expect((await checkRateLimit(options)).allowed).toBe(true);
    expect((await checkRateLimit(options)).allowed).toBe(false);
  });

  it("allows attempts again once the window has passed", async () => {
    await prisma.rateLimitAttempt.create({
      data: { action: "signup", identifier, createdAt: new Date(Date.now() - 120_000) },
    });
    const result = await checkRateLimit({ action: "signup", identifier, maxAttempts: 1, windowMs: 60_000 });
    expect(result.allowed).toBe(true);
  });
});
