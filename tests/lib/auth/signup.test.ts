import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn() },
    verificationToken: { create: vi.fn() },
  },
}));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/security/rateLimit", () => ({ checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }) }));

import { prisma } from "@/lib/db/prisma";
import { sendEmail } from "@/lib/email/send";
import { signupStudent } from "@/lib/auth/signup";

describe("signupStudent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a weak password without touching the database", async () => {
    const result = await signupStudent({ email: "a@example.test", password: "short" });
    expect(result.success).toBe(false);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("rejects an email that already has an account", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "existing" });
    const result = await signupStudent({ email: "a@example.test", password: "longenoughpassword1" });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already exists/i);
  });

  it("returns a friendly error instead of throwing when user creation fails (e.g. a race on a unique email)", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    (prisma.user.create as any).mockRejectedValue(new Error("unique constraint"));

    const result = await signupStudent({ email: "a@example.test", password: "longenoughpassword1" });

    expect(result).toEqual({ success: false, error: "Something went wrong. Please try again." });
  });

  it("creates a user, a verification token, and sends the verification email", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    (prisma.user.create as any).mockResolvedValue({ id: "u1", email: "a@example.test" });
    (sendEmail as any).mockResolvedValue({ delivered: true });

    const result = await signupStudent({ email: "a@example.test", password: "longenoughpassword1" });

    expect(result.success).toBe(true);
    expect(result.emailDelivered).toBe(true);
    expect(prisma.verificationToken.create).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "a@example.test", subject: expect.stringMatching(/verify/i) }),
    );
  });

  it("reports emailDelivered: false when no email provider is configured", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    (prisma.user.create as any).mockResolvedValue({ id: "u1", email: "a@example.test" });
    (sendEmail as any).mockResolvedValue({ delivered: false });

    const result = await signupStudent({ email: "a@example.test", password: "longenoughpassword1" });

    expect(result.success).toBe(true);
    expect(result.emailDelivered).toBe(false);
  });
});
