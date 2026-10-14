import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    verificationToken: { create: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
  },
}));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/auth/revokeSessions", () => ({ revokeAllSessions: vi.fn() }));

import { prisma } from "@/lib/db/prisma";
import { sendEmail } from "@/lib/email/send";
import { revokeAllSessions } from "@/lib/auth/revokeSessions";
import { requestPasswordReset, resetPassword } from "@/lib/auth/passwordReset";

describe("requestPasswordReset", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reports success without sending an email for an unknown address, to avoid leaking account existence", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    const result = await requestPasswordReset("nobody@example.test");
    expect(result.success).toBe(true);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends a reset email for a known address", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "u1", email: "a@example.test" });
    await requestPasswordReset("a@example.test");
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "a@example.test" }));
  });
});

describe("resetPassword", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects an expired or invalid token", async () => {
    (prisma.verificationToken.findUnique as any).mockResolvedValue(null);
    const result = await resetPassword("bad-token", "longenoughpassword1");
    expect(result.success).toBe(false);
  });

  it("rejects a weak new password", async () => {
    (prisma.verificationToken.findUnique as any).mockResolvedValue({
      token: "t1",
      userId: "u1",
      purpose: "password_reset",
      expiresAt: new Date(Date.now() + 10000),
    });
    const result = await resetPassword("t1", "short");
    expect(result.success).toBe(false);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("updates the password hash and revokes existing sessions on success", async () => {
    (prisma.verificationToken.findUnique as any).mockResolvedValue({
      token: "t1",
      userId: "u1",
      purpose: "password_reset",
      expiresAt: new Date(Date.now() + 10000),
    });
    const result = await resetPassword("t1", "longenoughpassword1");
    expect(result.success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalled();
    expect(revokeAllSessions).toHaveBeenCalledWith("u1");
    expect(prisma.verificationToken.delete).toHaveBeenCalledWith({ where: { token: "t1" } });
  });
});
