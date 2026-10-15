import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: { studentProfile: { findUnique: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/lib/onboarding/guardianConsent", () => ({ requestGuardianConsent: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getCurrentSessionUser: vi.fn() }));

import { prisma } from "@/lib/db/prisma";
import { requestGuardianConsent } from "@/lib/onboarding/guardianConsent";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { updateStudentProfile } from "@/lib/onboarding/updateProfile";

describe("updateStudentProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getCurrentSessionUser as any).mockResolvedValue({
      id: "u1",
      email: "a@example.test",
      emailVerified: new Date(),
    });
  });

  it("refuses to read or write any profile when there is no session", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(null);
    const result = await updateStudentProfile({ schoolName: "New School" });
    expect(result).toEqual({
      success: false,
      error: "You must be signed in to update your profile.",
    });
    expect(prisma.studentProfile.findUnique).not.toHaveBeenCalled();
    expect(prisma.studentProfile.update).not.toHaveBeenCalled();
  });

  it("scopes the read and write to the session's user id", async () => {
    (getCurrentSessionUser as any).mockResolvedValue({
      id: "session-user",
      email: "a@example.test",
      emailVerified: new Date(),
    });
    (prisma.studentProfile.findUnique as any).mockResolvedValue({
      id: "p1",
      dateOfBirth: new Date("2000-01-01"),
      guardian: null,
    });

    await updateStudentProfile({ schoolName: "New School" });

    expect(prisma.studentProfile.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "session-user" } }),
    );
    expect(prisma.studentProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "session-user" } }),
    );
  });

  it("does not re-trigger guardian consent for an unrelated field change", async () => {
    (prisma.studentProfile.findUnique as any).mockResolvedValue({
      id: "p1",
      dateOfBirth: new Date("2000-01-01"),
      guardian: null,
    });
    await updateStudentProfile({ schoolName: "New School" });
    expect(requestGuardianConsent).not.toHaveBeenCalled();
  });

  it("re-triggers guardian consent when a DOB edit makes the student under 18", async () => {
    (prisma.studentProfile.findUnique as any).mockResolvedValue({
      id: "p1",
      dateOfBirth: new Date("2000-01-01"),
      guardian: null,
    });
    await updateStudentProfile({
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
    await updateStudentProfile({ guardian: { name: "Old Parent", email: "new@example.test" } });
    expect(requestGuardianConsent).toHaveBeenCalledWith("p1", { name: "Old Parent", email: "new@example.test" });
  });

  it("rejects a DOB edit that makes the student newly under 18 when no guardian is on file and none is supplied", async () => {
    (prisma.studentProfile.findUnique as any).mockResolvedValue({
      id: "p1",
      dateOfBirth: new Date("2000-01-01"),
      guardian: null,
    });
    const result = await updateStudentProfile({ dateOfBirth: "2015-01-01" });
    expect(result).toEqual({
      success: false,
      error: "A guardian name and email are required for students under 18.",
    });
    expect(prisma.studentProfile.update).not.toHaveBeenCalled();
    expect(requestGuardianConsent).not.toHaveBeenCalled();
  });
});
