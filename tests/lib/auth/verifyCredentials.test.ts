import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/security/rateLimit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

import { prisma } from "@/lib/db/prisma";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { verifyCredentials } from "@/lib/auth/verifyCredentials";
import bcrypt from "bcryptjs";

describe("verifyCredentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (checkRateLimit as any).mockResolvedValue({ allowed: true });
  });

  it("returns null without touching the database once the login rate limit trips", async () => {
    (checkRateLimit as any).mockResolvedValue({ allowed: false });
    expect(await verifyCredentials("student@example.test", "correct-horse-1")).toBeNull();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("returns null for an unknown email", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    expect(await verifyCredentials("nobody@example.test", "whatever123")).toBeNull();
  });

  it("returns null for an unverified user, even with the correct password", async () => {
    const hash = await bcrypt.hash("correct-horse-1", 12);
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "u1",
      email: "student@example.test",
      passwordHash: hash,
      emailVerified: null,
    });
    expect(await verifyCredentials("student@example.test", "correct-horse-1")).toBeNull();
  });

  it("returns null for a wrong password", async () => {
    const hash = await bcrypt.hash("correct-horse-1", 12);
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "u1",
      email: "student@example.test",
      passwordHash: hash,
      emailVerified: new Date(),
    });
    expect(await verifyCredentials("student@example.test", "wrong-password")).toBeNull();
  });

  it("returns the user for correct credentials on a verified account", async () => {
    const hash = await bcrypt.hash("correct-horse-1", 12);
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "u1",
      email: "student@example.test",
      passwordHash: hash,
      emailVerified: new Date(),
    });
    expect(await verifyCredentials("student@example.test", "correct-horse-1")).toEqual({
      id: "u1",
      email: "student@example.test",
    });
  });
});
