import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    studentProfile: { findUnique: vi.fn() },
    planEntry: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/auth/session", () => ({ getCurrentSessionUser: vi.fn() }));

import { prisma } from "@/lib/db/prisma";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { getProgressData, getCurrentStreak } from "@/lib/progress/progressService";

const sessionUser = { id: "u1", email: "s@example.test", emailVerified: new Date() };
const profile = { id: "p1", userId: "u1", timezone: "UTC" };

describe("getProgressData", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an empty, honest result with no session", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(null);
    const result = await getProgressData("week");
    expect(result.completion).toEqual([]);
    expect(result.subjectTime).toEqual([]);
    expect(result.hasActivity).toBe(false);
  });

  it("queries a 7-day window for 'week' and a 30-day window for 'month'", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.planEntry.findMany as any).mockResolvedValue([]);

    await getProgressData("week");
    const weekCall = (prisma.planEntry.findMany as any).mock.calls[0][0];
    const weekSpanMs = new Date().getTime() - weekCall.where.date.gte.getTime();
    expect(weekSpanMs).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000 + 1000);

    vi.clearAllMocks();
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.planEntry.findMany as any).mockResolvedValue([]);
    await getProgressData("month");
    const monthCall = (prisma.planEntry.findMany as any).mock.calls[0][0];
    const monthSpanMs = new Date().getTime() - monthCall.where.date.gte.getTime();
    expect(monthSpanMs).toBeGreaterThan(7 * 24 * 60 * 60 * 1000);
  });

  it("reports hasActivity false and empty arrays when the window has no plan entries", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.planEntry.findMany as any).mockResolvedValue([]);
    const result = await getProgressData("week");
    expect(result.hasActivity).toBe(false);
    expect(result.completion).toEqual([]);
    expect(result.subjectTime).toEqual([]);
  });

  it("reports hasActivity true and real aggregates when the window has plan entries", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.planEntry.findMany as any).mockResolvedValue([
      {
        date: new Date(),
        subjectId: "s1",
        subject: { name: "Math" },
        estimatedMinutes: 30,
        checkInStatus: "done",
      },
    ]);
    const result = await getProgressData("week");
    expect(result.hasActivity).toBe(true);
    expect(result.subjectTime).toEqual([{ subjectId: "s1", subjectName: "Math", plannedMinutes: 30, actualMinutes: 30 }]);
  });
});

describe("getCurrentStreak", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 0 with no session", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(null);
    expect(await getCurrentStreak()).toBe(0);
  });

  it("queries up to 365 days back, independent of the week/month window", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.planEntry.findMany as any).mockResolvedValue([]);
    await getCurrentStreak();
    const call = (prisma.planEntry.findMany as any).mock.calls[0][0];
    const spanDays = (new Date().getTime() - call.where.date.gte.getTime()) / (24 * 60 * 60 * 1000);
    expect(spanDays).toBeGreaterThan(30);
  });
});
