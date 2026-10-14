import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    verificationToken: { findUnique: vi.fn(), delete: vi.fn() },
    user: { update: vi.fn() },
  },
}));

import { prisma } from "@/lib/db/prisma";
import { verifyEmailToken } from "@/lib/auth/verifyEmail";

describe("verifyEmailToken", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects an unknown token", async () => {
    (prisma.verificationToken.findUnique as any).mockResolvedValue(null);
    const result = await verifyEmailToken("nonexistent");
    expect(result.success).toBe(false);
  });

  it("rejects and deletes an expired token without verifying the user", async () => {
    (prisma.verificationToken.findUnique as any).mockResolvedValue({
      token: "t1",
      userId: "u1",
      purpose: "email_verify",
      expiresAt: new Date(Date.now() - 1000),
    });
    const result = await verifyEmailToken("t1");
    expect(result.success).toBe(false);
    expect(prisma.verificationToken.delete).toHaveBeenCalledWith({ where: { token: "t1" } });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("verifies the user and deletes a valid token", async () => {
    (prisma.verificationToken.findUnique as any).mockResolvedValue({
      token: "t1",
      userId: "u1",
      purpose: "email_verify",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    });
    const result = await verifyEmailToken("t1");
    expect(result.success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { emailVerified: expect.any(Date) },
    });
    expect(prisma.verificationToken.delete).toHaveBeenCalledWith({ where: { token: "t1" } });
  });
});
