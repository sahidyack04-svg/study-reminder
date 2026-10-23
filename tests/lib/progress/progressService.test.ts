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
import { todayInTimezone } from "@/lib/validation/age";
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

  it("scopes the plan-entry query to the signed-in student's own profile, not any id the caller might supply", async () => {
    const otherSessionUser = { id: "u2", email: "other@example.test", emailVerified: new Date() };
    const otherProfile = { id: "p2", userId: "u2", timezone: "UTC" };
    (getCurrentSessionUser as any).mockResolvedValue(otherSessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(otherProfile);
    (prisma.planEntry.findMany as any).mockResolvedValue([]);

    await getProgressData("week");

    expect(prisma.studentProfile.findUnique).toHaveBeenCalledWith({ where: { userId: "u2" } });
    const call = (prisma.planEntry.findMany as any).mock.calls[0][0];
    expect(call.where.studentProfileId).toBe("p2");
    expect(call.where.studentProfileId).not.toBe("p1");
  });

  it("orders plan entries chronologically, so the completion chart's day order does not depend on incidental row order", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.planEntry.findMany as any).mockResolvedValue([]);

    await getProgressData("week");

    const call = (prisma.planEntry.findMany as any).mock.calls[0][0];
    expect(call.orderBy).toEqual({ date: "asc" });
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

  it("treats a missing-today as empty rather than letting yesterday masquerade as today", async () => {
    // Regression test: today has NO PlanEntry rows yet (plan not generated),
    // yesterday has a pending (unchecked) entry, and two days ago is fully
    // done. If "today" is correctly recognized as index 0 (empty, skipped),
    // yesterday is correctly recognized as a PAST day whose pending entry
    // breaks the streak before "two days ago" is ever reached -> streak 0.
    // If today is silently absent and yesterday wrongly sorts into index 0,
    // yesterday gets the lenient "pending today" treatment instead, the
    // streak doesn't break, and "two days ago" wrongly counts -> streak 1.
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);

    const today = todayInTimezone(profile.timezone);
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);

    (prisma.planEntry.findMany as any).mockResolvedValue([
      { date: twoDaysAgo, subjectId: "s1", subject: { name: "Math" }, estimatedMinutes: 30, checkInStatus: "done" },
      { date: yesterday, subjectId: "s1", subject: { name: "Math" }, estimatedMinutes: 30, checkInStatus: "pending" },
    ]);

    expect(await getCurrentStreak()).toBe(0);
  });

  it("scopes the streak lookback query to the signed-in student's own profile, not any id the caller might supply", async () => {
    const otherSessionUser = { id: "u2", email: "other@example.test", emailVerified: new Date() };
    const otherProfile = { id: "p2", userId: "u2", timezone: "UTC" };
    (getCurrentSessionUser as any).mockResolvedValue(otherSessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(otherProfile);
    (prisma.planEntry.findMany as any).mockResolvedValue([]);

    await getCurrentStreak();

    const call = (prisma.planEntry.findMany as any).mock.calls[0][0];
    expect(call.where.studentProfileId).toBe("p2");
    expect(call.where.studentProfileId).not.toBe("p1");
  });
});
