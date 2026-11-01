import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    verificationToken: { create: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
  },
}));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/security/rateLimit", () => ({ checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }) }));

import { prisma } from "@/lib/db/prisma";
import { sendEmail } from "@/lib/email/send";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { hashToken } from "@/lib/validation/tokens";
import { verifyEmailToken, resendVerificationEmail } from "@/lib/auth/verifyEmail";

describe("verifyEmailToken", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects an unknown token", async () => {
    (prisma.verificationToken.findUnique as any).mockResolvedValue(null);
    const result = await verifyEmailToken("bad-token");
    expect(result.success).toBe(false);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects a token created for a different purpose (e.g. password reset)", async () => {
    (prisma.verificationToken.findUnique as any).mockResolvedValue({
      token: hashToken("t1"),
      userId: "u1",
      purpose: "password_reset",
      expiresAt: new Date(Date.now() + 10000),
    });
    const result = await verifyEmailToken("t1");
    expect(result.success).toBe(false);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects and deletes an expired token, so it cannot be reused later", async () => {
    (prisma.verificationToken.findUnique as any).mockResolvedValue({
      token: hashToken("t1"),
      userId: "u1",
      purpose: "email_verify",
      expiresAt: new Date(Date.now() - 1000),
    });
    const result = await verifyEmailToken("t1");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/expired/i);
    expect(prisma.verificationToken.delete).toHaveBeenCalledWith({ where: { token: hashToken("t1") } });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("marks the user verified and deletes the token on success, so it is single-use", async () => {
    (prisma.verificationToken.findUnique as any).mockResolvedValue({
      token: hashToken("t1"),
      userId: "u1",
      purpose: "email_verify",
      expiresAt: new Date(Date.now() + 10000),
    });
    const result = await verifyEmailToken("t1");
    expect(result.success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { emailVerified: expect.any(Date) },
    });
    expect(prisma.verificationToken.delete).toHaveBeenCalledWith({ where: { token: hashToken("t1") } });
  });

  it("rejects a reused (already-deleted) token on a second attempt", async () => {
    (prisma.verificationToken.findUnique as any).mockResolvedValueOnce({
      token: hashToken("t1"),
      userId: "u1",
      purpose: "email_verify",
      expiresAt: new Date(Date.now() + 10000),
    });
    const first = await verifyEmailToken("t1");
    expect(first.success).toBe(true);

    (prisma.verificationToken.findUnique as any).mockResolvedValueOnce(null);
    const second = await verifyEmailToken("t1");
    expect(second.success).toBe(false);
  });
});

describe("resendVerificationEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reports success without sending for an unknown address, to avoid leaking account existence", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    const result = await resendVerificationEmail("nobody@example.test");
    expect(result.success).toBe(true);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("reports success without sending for an already-verified address", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "u1", email: "a@example.test", emailVerified: new Date() });
    const result = await resendVerificationEmail("a@example.test");
    expect(result.success).toBe(true);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends a new verification email for an existing unverified address", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "u1", email: "a@example.test", emailVerified: null });
    await resendVerificationEmail("a@example.test");
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "a@example.test",
        subject: "Verify your Study Reminder account",
        body: expect.stringContaining("/verify-email?token="),
      }),
    );
  });

  it("reports success without sending once the rate limit is exceeded", async () => {
    (checkRateLimit as any).mockResolvedValueOnce({ allowed: false });
    const result = await resendVerificationEmail("a@example.test");
    expect(result.success).toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
