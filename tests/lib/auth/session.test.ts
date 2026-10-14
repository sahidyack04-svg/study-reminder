import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSessionUser } from "@/lib/auth/session";

describe("getCurrentSessionUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when there is no session", async () => {
    (auth as any).mockResolvedValue(null);
    expect(await getCurrentSessionUser()).toBeNull();
  });

  it("returns null when the session's sessionVersion no longer matches the database (revoked)", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", email: "s@example.test", sessionVersion: 1 } });
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "u1",
      email: "s@example.test",
      emailVerified: new Date(),
      sessionVersion: 2,
    });
    expect(await getCurrentSessionUser()).toBeNull();
  });

  it("returns the user when the session version matches", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", email: "s@example.test", sessionVersion: 1 } });
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "u1",
      email: "s@example.test",
      emailVerified: new Date("2026-01-01"),
      sessionVersion: 1,
    });
    expect(await getCurrentSessionUser()).toEqual({
      id: "u1",
      email: "s@example.test",
      emailVerified: new Date("2026-01-01"),
    });
  });
});
