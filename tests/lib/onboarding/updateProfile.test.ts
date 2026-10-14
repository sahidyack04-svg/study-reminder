import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: { studentProfile: { findUnique: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/lib/onboarding/guardianConsent", () => ({ requestGuardianConsent: vi.fn() }));

import { prisma } from "@/lib/db/prisma";
import { requestGuardianConsent } from "@/lib/onboarding/guardianConsent";
import { updateStudentProfile } from "@/lib/onboarding/updateProfile";

describe("updateStudentProfile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not re-trigger guardian consent for an unrelated field change", async () => {
    (prisma.studentProfile.findUnique as any).mockResolvedValue({
      id: "p1",
      dateOfBirth: new Date("2000-01-01"),
      guardian: null,
    });
    await updateStudentProfile("u1", { schoolName: "New School" });
    expect(requestGuardianConsent).not.toHaveBeenCalled();
  });

  it("re-triggers guardian consent when a DOB edit makes the student under 18", async () => {
    (prisma.studentProfile.findUnique as any).mockResolvedValue({
      id: "p1",
      dateOfBirth: new Date("2000-01-01"),
      guardian: null,
    });
    await updateStudentProfile("u1", {
      dateOfBirth: "2015-01-01",
      guardian: { name: "Parent", email: "parent@example.test" },
    });
    expect(requestGuardianConsent).toHaveBeenCalledWith("p1", { name: "Parent", email: "parent@example.test" });
  });

  it("re-triggers guardian consent when the guardian's email changes while still required", async () => {
    (prisma.studentProfile.findUnique as any).mockResolvedValue({
      id: "p1",
      dateOfBirth: new Date("2015-01-01"),
      guardian: { name: "Old Parent", email: "old@example.test", consentGivenAt: new Date() },
    });
    await updateStudentProfile("u1", { guardian: { name: "Old Parent", email: "new@example.test" } });
    expect(requestGuardianConsent).toHaveBeenCalledWith("p1", { name: "Old Parent", email: "new@example.test" });
  });
});
