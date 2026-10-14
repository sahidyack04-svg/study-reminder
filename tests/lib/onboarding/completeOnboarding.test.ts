import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: { studentProfile: { create: vi.fn() }, timetableEntry: { createMany: vi.fn() }, goal: { createMany: vi.fn() } },
}));
vi.mock("@/lib/onboarding/guardianConsent", () => ({ requestGuardianConsent: vi.fn() }));

import { prisma } from "@/lib/db/prisma";
import { requestGuardianConsent } from "@/lib/onboarding/guardianConsent";
import { completeOnboarding, type OnboardingInput } from "@/lib/onboarding/completeOnboarding";

function baseInput(overrides: Partial<OnboardingInput> = {}): OnboardingInput {
  return {
    userId: "u1",
    name: "Alex",
    dateOfBirth: "2010-01-01",
    grade: "9",
    schoolName: "Maple High",
    curriculum: "State Board",
    academicYear: "2026-2027",
    timezone: "Asia/Kolkata",
    subjects: ["Math", "Science"],
    timetable: [],
    availability: [],
    goals: [],
    reminderChannel: "none",
    preferredTimes: [],
    ...overrides,
  };
}

describe("completeOnboarding", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects overlapping timetable entries before writing anything", async () => {
    const input = baseInput({
      timetable: [
        { dayOfWeek: 1, startTime: "09:00", endTime: "10:30" },
        { dayOfWeek: 1, startTime: "10:00", endTime: "11:00" },
      ],
    });
    const result = await completeOnboarding(input);
    expect(result.success).toBe(false);
    expect(prisma.studentProfile.create).not.toHaveBeenCalled();
  });

  it("requires a guardian when the student is under 18", async () => {
    const input = baseInput({ dateOfBirth: "2015-01-01" });
    const result = await completeOnboarding(input);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/guardian/i);
  });

  it("does not require a guardian for a student whose 18th birthday is today", async () => {
    const eighteenToday = new Date();
    eighteenToday.setFullYear(eighteenToday.getFullYear() - 18);
    (prisma.studentProfile.create as any).mockResolvedValue({ id: "p1", subjects: [] });

    const input = baseInput({ dateOfBirth: eighteenToday.toISOString().slice(0, 10) });
    const result = await completeOnboarding(input);

    expect(result.success).toBe(true);
    expect(result.guardianConsentRequired).toBe(false);
    expect(requestGuardianConsent).not.toHaveBeenCalled();
  });

  it("creates the profile and requests guardian consent when under 18 with a guardian provided", async () => {
    (prisma.studentProfile.create as any).mockResolvedValue({ id: "p1", subjects: [] });

    const input = baseInput({
      dateOfBirth: "2015-01-01",
      guardian: { name: "Parent", email: "parent@example.test" },
    });
    const result = await completeOnboarding(input);

    expect(result.success).toBe(true);
    expect(result.guardianConsentRequired).toBe(true);
    expect(requestGuardianConsent).toHaveBeenCalledWith("p1", { name: "Parent", email: "parent@example.test" });
  });
});
