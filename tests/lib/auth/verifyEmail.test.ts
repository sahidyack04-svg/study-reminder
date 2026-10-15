import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    verificationToken: { findUnique: vi.fn(), delete: vi.fn(), create: vi.fn() },
    user: { update: vi.fn(), findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/security/rateLimit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

import { prisma } from "@/lib/db/prisma";
import { sendEmail } from "@/lib/email/send";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { verifyEmailToken, resendVerificationEmail } from "@/lib/auth/verifyEmail";

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

describe("resendVerificationEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (checkRateLimit as any).mockResolvedValue({ allowed: true });
  });

  it("reports success for an unknown email without creating a token or sending anything", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    const result = await resendVerificationEmail("nobody@example.test");
    expect(result).toEqual({ success: true });
    expect(prisma.verificationToken.create).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("creates a fresh token and emails a link for a known unverified account", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "u1",
      email: "student@example.test",
      emailVerified: null,
    });

    const result = await resendVerificationEmail("student@example.test");

    expect(result).toEqual({ success: true });
    expect(prisma.verificationToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "u1", purpose: "email_verify" }),
    });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "student@example.test" }),
    );
  });

  it("does nothing for an already-verified account but still reports success", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "u1",
      email: "student@example.test",
      emailVerified: new Date(),
    });

    const result = await resendVerificationEmail("student@example.test");

    expect(result).toEqual({ success: true });
    expect(prisma.verificationToken.create).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("silently skips sending when the rate limit is exhausted", async () => {
    (checkRateLimit as any).mockResolvedValue({ allowed: false });

    const result = await resendVerificationEmail("student@example.test");

    expect(result).toEqual({ success: true });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
