import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    studentProfile: { findMany: vi.fn() },
    task: { count: vi.fn() },
    reminderLog: { findUnique: vi.fn(), create: vi.fn() },
    // $executeRaw backs the pg_advisory_xact_lock call inside the
    // $transaction callback (same pattern as checkRateLimit's tests) --
    // the real $transaction mock below passes `prisma` itself as `tx`, so
    // this stub needs to exist on the same object.
    $executeRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn() }));

import { prisma } from "@/lib/db/prisma";
import { sendEmail } from "@/lib/email/send";
import { GET } from "@/app/api/cron/daily-reminders/route";

function req(secret?: string) {
  return new Request("http://localhost/api/cron/daily-reminders", {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

describe("GET /api/cron/daily-reminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
    (prisma.$transaction as any).mockImplementation((cb: any) => cb(prisma));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects a request with a missing or wrong CRON_SECRET without touching the database", async () => {
    const res = await GET(req("wrong-secret"));
    expect(res.status).toBe(401);
    expect(prisma.studentProfile.findMany).not.toHaveBeenCalled();
  });

  it("skips a student inside their own quiet hours even if the preferred time matches", async () => {
    // Pinned so "current time in UTC" is deterministically "12:00" -- without
    // this, the match-and-quiet-hours branches below are only exercised for
    // part of a real day (see the overnight-window tests for the same
    // pinning technique, required after this test was found to be flaky).
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-14T12:00:00.000Z"));

    (prisma.studentProfile.findMany as any).mockResolvedValue([
      {
        id: "p1", timezone: "UTC",
        reminderPreference: {
          channel: "email", preferredTimes: JSON.stringify(["12:00"]),
          quietHoursStart: "11:00", quietHoursEnd: "13:00",
        },
      },
    ]);
    await GET(req("test-secret"));
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends at most one reminder per student/date/channel across two invocations (idempotency), locking before checking for an existing log, and logs the real delivered value", async () => {
    (prisma.studentProfile.findMany as any).mockResolvedValue([
      {
        id: "p1", timezone: "UTC",
        reminderPreference: { channel: "email", preferredTimes: JSON.stringify(["00:00"]), quietHoursStart: null, quietHoursEnd: null },
      },
    ]);
    (prisma.reminderLog.findUnique as any)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "log1" });
    (prisma.task.count as any).mockResolvedValue(2);
    (sendEmail as any).mockResolvedValue({ delivered: false, reason: "no_provider" });

    await GET(req("test-secret"));
    await GET(req("test-secret"));

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(prisma.reminderLog.create).toHaveBeenCalledTimes(1);

    // The advisory lock must actually be taken, and taken BEFORE the
    // existence check it's meant to protect -- a regression that reordered
    // these (the exact bug the lock exists to prevent) would otherwise pass
    // the rest of this suite undetected.
    expect(prisma.$executeRaw).toHaveBeenCalled();
    const lockOrder = (prisma.$executeRaw as any).mock.invocationCallOrder[0];
    const findUniqueOrder = (prisma.reminderLog.findUnique as any).mock.invocationCallOrder[0];
    expect(lockOrder).toBeLessThan(findUniqueOrder);

    // delivered must come from sendEmail's own return value, not a
    // hardcoded true -- sendEmail was mocked to resolve delivered:false.
    expect(prisma.reminderLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ delivered: false }) }),
    );
  });

  it("never calls sendEmail for a whatsapp-channel student and logs an honest delivered:false", async () => {
    (prisma.studentProfile.findMany as any).mockResolvedValue([
      {
        id: "p1", timezone: "UTC",
        reminderPreference: { channel: "whatsapp", preferredTimes: JSON.stringify(["00:00"]), quietHoursStart: null, quietHoursEnd: null },
      },
    ]);
    (prisma.reminderLog.findUnique as any).mockResolvedValue(null);
    (prisma.task.count as any).mockResolvedValue(1);

    await GET(req("test-secret"));

    expect(sendEmail).not.toHaveBeenCalled();
    expect(prisma.reminderLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ channel: "whatsapp", delivered: false }) }),
    );
  });

  describe("overnight quiet hours (21:00-07:00)", () => {
    it("skips sending when the current time is inside the overnight window (23:00)", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-10-14T23:00:00.000Z"));

      (prisma.studentProfile.findMany as any).mockResolvedValue([
        {
          id: "p1", timezone: "UTC",
          reminderPreference: {
            channel: "email", preferredTimes: JSON.stringify(["20:00"]),
            quietHoursStart: "21:00", quietHoursEnd: "07:00",
          },
        },
      ]);

      await GET(req("test-secret"));
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it("attempts to send when the current time is outside the overnight window (12:00)", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-10-14T12:00:00.000Z"));

      (prisma.studentProfile.findMany as any).mockResolvedValue([
        {
          id: "p1", timezone: "UTC",
          reminderPreference: {
            channel: "email", preferredTimes: JSON.stringify(["08:00"]),
            quietHoursStart: "21:00", quietHoursEnd: "07:00",
          },
        },
      ]);
      (prisma.reminderLog.findUnique as any).mockResolvedValue(null);
      (prisma.task.count as any).mockResolvedValue(0);
      (sendEmail as any).mockResolvedValue({ delivered: true });

      await GET(req("test-secret"));
      expect(sendEmail).toHaveBeenCalledTimes(1);
    });
  });
});
