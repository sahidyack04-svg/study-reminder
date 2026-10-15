import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => {
  const prismaMock: any = {
    studentProfile: { create: vi.fn() },
    timetableEntry: { createMany: vi.fn() },
    goal: { createMany: vi.fn() },
  };
  // $transaction hands the callback the same mocked client as `tx`, so tests
  // can configure studentProfile.create / timetableEntry.createMany / goal.createMany
  // directly on `prisma` without needing to know about the transaction wrapper.
  prismaMock.$transaction = vi.fn((fn: any) => fn(prismaMock));
  return { prisma: prismaMock };
});
vi.mock("@/lib/onboarding/guardianConsent", () => ({ requestGuardianConsent: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getCurrentSessionUser: vi.fn() }));

import { prisma } from "@/lib/db/prisma";
import { requestGuardianConsent } from "@/lib/onboarding/guardianConsent";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { completeOnboarding, type OnboardingInput } from "@/lib/onboarding/completeOnboarding";

function baseInput(overrides: Partial<OnboardingInput> = {}): OnboardingInput {
  return {
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
  beforeEach(() => {
    vi.clearAllMocks();
    (getCurrentSessionUser as any).mockResolvedValue({
      id: "u1",
      email: "a@example.test",
      emailVerified: new Date(),
    });
  });

  it("refuses to write anything when there is no session", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(null);
    const result = await completeOnboarding(baseInput());
    expect(result).toEqual({
      success: false,
      error: "You must be signed in to complete onboarding.",
    });
    expect(prisma.studentProfile.create).not.toHaveBeenCalled();
  });

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

  it("writes the profile against the session's user id, not any client-supplied value", async () => {
    (getCurrentSessionUser as any).mockResolvedValue({
      id: "session-user",
      email: "a@example.test",
      emailVerified: new Date(),
    });
    (prisma.studentProfile.create as any).mockResolvedValue({ id: "p1", subjects: [] });

    const result = await completeOnboarding({
      ...baseInput({ dateOfBirth: "2000-01-01" }),
      // an attacker POSTing an extra userId field must have no effect
      userId: "victim-user",
    } as OnboardingInput);

    expect(result.success).toBe(true);
    expect(prisma.studentProfile.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: "session-user" }) }),
    );
  });

  it("returns a friendly error instead of throwing when a write fails partway through", async () => {
    (prisma.studentProfile.create as any).mockResolvedValue({ id: "p1", subjects: [] });
    (prisma.timetableEntry.createMany as any).mockRejectedValue(new Error("db error"));

    const input = baseInput({
      timetable: [{ dayOfWeek: 1, startTime: "09:00", endTime: "10:00" }],
      guardian: { name: "Parent", email: "parent@example.test" },
    });
    const result = await completeOnboarding(input);

    expect(result).toEqual({ success: false, error: "Something went wrong. Please try again." });
  });
});
