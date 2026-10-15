import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: { guardian: { upsert: vi.fn(), findUnique: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/security/rateLimit", () => ({ checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }) }));

import { prisma } from "@/lib/db/prisma";
import { sendEmail } from "@/lib/email/send";
import { requestGuardianConsent, approveGuardianConsent } from "@/lib/onboarding/guardianConsent";

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
