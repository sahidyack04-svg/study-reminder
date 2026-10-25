import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/security/rateLimit", () => ({ checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }) }));

import { prisma } from "@/lib/db/prisma";
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

  it("creates a user immediately, with no email-verification step", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    (prisma.user.create as any).mockResolvedValue({ id: "u1", email: "a@example.test" });

    const result = await signupStudent({ email: "a@example.test", password: "longenoughpassword1" });

    expect(result).toEqual({ success: true });
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: "a@example.test" }) }),
    );
  });
});
