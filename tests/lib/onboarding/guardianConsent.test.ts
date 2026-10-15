import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    guardian: { upsert: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    studentProfile: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/security/rateLimit", () => ({ checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }) }));
vi.mock("@/lib/auth/session", () => ({ getCurrentSessionUser: vi.fn() }));

import { prisma } from "@/lib/db/prisma";
import { sendEmail } from "@/lib/email/send";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { requestGuardianConsent } from "@/lib/onboarding/guardianConsent";
import {
  approveGuardianConsent,
  resendGuardianConsentForCurrentUser,
} from "@/lib/onboarding/guardianConsentActions";

describe("the guardian-consent server action surface", () => {
  // requestGuardianConsent takes a studentProfileId straight from its caller
  // and returns the Guardian record including consentToken. It must never be
  // reachable as a standalone RPC endpoint.
  it("does not expose requestGuardianConsent as a server action", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");

    const plainModule = readFileSync(
      resolve(__dirname, "../../../src/lib/onboarding/guardianConsent.ts"),
      "utf8",
    );
    const actionsModule = readFileSync(
      resolve(__dirname, "../../../src/lib/onboarding/guardianConsentActions.ts"),
      "utf8",
    );

    // The module holding requestGuardianConsent carries no "use server"
    // directive of any kind (file-level or inline). A directive is a
    // statement at the start of a line; prose mentions in comments are not.
    expect(plainModule).not.toMatch(/^\s*["']use server["']/m);
    // ...and the "use server" boundary does not re-export it.
    expect(actionsModule).toMatch(/^\s*["']use server["']/m);
    expect(actionsModule).not.toMatch(/export\s+(async\s+function|\{[^}]*)\s*requestGuardianConsent/);
  });
});

describe("requestGuardianConsent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stores the guardian and emails a consent link", async () => {
    (prisma.guardian.upsert as any).mockResolvedValue({ id: "g1" });
    await requestGuardianConsent("profile1", { name: "Parent", email: "parent@example.test" });
    expect(prisma.guardian.upsert).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "parent@example.test" }));
  });
});

describe("approveGuardianConsent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects an unknown token without revealing anything about it", async () => {
    (prisma.guardian.findUnique as any).mockResolvedValue(null);
    const result = await approveGuardianConsent("bad-token");
    expect(result.success).toBe(false);
  });

  it("is idempotent when the link is opened again after already being approved", async () => {
    (prisma.guardian.findUnique as any).mockResolvedValue({ id: "g1", consentGivenAt: new Date() });
    const result = await approveGuardianConsent("t1");
    expect(result.success).toBe(true);
    expect(result.alreadyApproved).toBe(true);
    expect(prisma.guardian.update).not.toHaveBeenCalled();
  });

  it("records consent on first approval", async () => {
    (prisma.guardian.findUnique as any).mockResolvedValue({ id: "g1", consentGivenAt: null });
    const result = await approveGuardianConsent("t1");
    expect(result.success).toBe(true);
    expect(prisma.guardian.update).toHaveBeenCalledWith({
      where: { id: "g1" },
      data: { consentGivenAt: expect.any(Date) },
    });
  });
});

describe("resendGuardianConsentForCurrentUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (checkRateLimit as any).mockResolvedValue({ allowed: true });
    (getCurrentSessionUser as any).mockResolvedValue({
      id: "u1",
      email: "student@example.test",
      emailVerified: new Date(),
    });
  });

  it("refuses when there is no session", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(null);
    const result = await resendGuardianConsentForCurrentUser();
    expect(result).toEqual({ success: false, error: "You must be signed in." });
    expect(prisma.studentProfile.findUnique).not.toHaveBeenCalled();
  });

  it("refuses when no guardian is on file", async () => {
    (prisma.studentProfile.findUnique as any).mockResolvedValue({ id: "p1", guardian: null });
    const result = await resendGuardianConsentForCurrentUser();
    expect(result).toEqual({ success: false, error: "No guardian is on file." });
    expect(prisma.guardian.upsert).not.toHaveBeenCalled();
  });

  it("re-sends a consent request to the guardian already on file", async () => {
    (prisma.studentProfile.findUnique as any).mockResolvedValue({
      id: "p1",
      guardian: { name: "Parent", email: "parent@example.test" },
    });
    (prisma.guardian.upsert as any).mockResolvedValue({ id: "g1" });

    const result = await resendGuardianConsentForCurrentUser();

    expect(result).toEqual({ success: true });
    expect(prisma.studentProfile.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1" } }),
    );
    expect(prisma.guardian.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentProfileId: "p1" },
        update: expect.objectContaining({ name: "Parent", email: "parent@example.test" }),
      }),
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "parent@example.test" }),
    );
  });

  it("returns a friendly error instead of throwing when the consent rate limit trips", async () => {
    (prisma.studentProfile.findUnique as any).mockResolvedValue({
      id: "p1",
      guardian: { name: "Parent", email: "parent@example.test" },
    });
    (checkRateLimit as any).mockResolvedValue({ allowed: false });

    const result = await resendGuardianConsentForCurrentUser();

    expect(result).toEqual({
      success: false,
      error: "Too many consent requests sent recently. Please try again later.",
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
