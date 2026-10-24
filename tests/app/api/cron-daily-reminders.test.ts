import { describe, it, expect, vi, beforeEach } from "vitest";

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

  it("rejects a request with a missing or wrong CRON_SECRET without touching the database", async () => {
    const res = await GET(req("wrong-secret"));
    expect(res.status).toBe(401);
    expect(prisma.studentProfile.findMany).not.toHaveBeenCalled();
  });

  it("skips a student inside their own quiet hours even if the preferred time matches", async () => {
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

  it("sends at most one reminder per student/date/channel across two invocations (idempotency)", async () => {
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
  });
});
