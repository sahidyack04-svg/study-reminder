import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";

describe("prisma client", () => {
  const testEmail = `prisma-smoke-${Date.now()}@example.test`;

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: testEmail } });
    await prisma.$disconnect();
  });

  it("can create and read a user row", async () => {
    const created = await prisma.user.create({
      data: { email: testEmail, passwordHash: "test-hash" },
    });

    const found = await prisma.user.findUnique({ where: { id: created.id } });

    expect(found?.email).toBe(testEmail);
  });
});
