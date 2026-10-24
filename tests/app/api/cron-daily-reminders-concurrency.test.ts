// Real-Postgres concurrency proof for the daily-reminders idempotency
// guarantee ("at most one reminder per student/date/channel").
//
// Deliberately a sibling file rather than a case inside
// cron-daily-reminders.test.ts: that file module-mocks @/lib/db/prisma, and
// the whole point here is that NOTHING is mocked. The advisory-lock pattern
// only means anything against real concurrent Postgres transactions under
// READ COMMITTED -- a mock can show the calls happened in the right order
// but can never show that two overlapping transactions actually serialize.
// Same shape as the TOCTOU regression guard in
// tests/lib/security/rateLimit.test.ts (real prisma, Promise.all over N
// concurrent calls, assert the invariant on the real rows).
import { describe, it, expect, afterEach, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { GET } from "@/app/api/cron/daily-reminders/route";

const CRON_SECRET = "concurrency-test-secret";

function req() {
  return new Request("http://localhost/api/cron/daily-reminders", {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
}

describe("GET /api/cron/daily-reminders under real concurrency", () => {
  let userId: string | null = null;

  afterEach(async () => {
    vi.restoreAllMocks();
    if (userId) {
      // StudentProfile (and its ReminderPreference / ReminderLog rows)
      // cascade from the user.
      await prisma.user.delete({ where: { id: userId } });
      userId = null;
    }
  });

  it("creates exactly one ReminderLog row when five invocations run concurrently", async () => {
    process.env.CRON_SECRET = CRON_SECRET;
    // sendEmail with no RESEND_API_KEY only records a dev email and logs a
    // line; it never reaches a provider. Silence both console channels so
    // the error spy below sees only genuine per-profile failures.
    vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const user = await prisma.user.create({
      data: {
        email: `cron-concurrency-${Date.now()}@example.test`,
        passwordHash: "x",
        emailVerified: new Date(),
      },
    });
    userId = user.id;

    const profile = await prisma.studentProfile.create({
      data: {
        userId: user.id, name: "Concurrency Student", dateOfBirth: new Date("2010-01-01"),
        grade: "8", schoolName: "Test School", curriculum: "General", academicYear: "2026",
        // UTC + a preferred time of 00:00 makes this student eligible on
        // every invocation, at any wall-clock time, with no fake timers.
        timezone: "UTC",
        reminderPreference: {
          create: {
            channel: "email",
            preferredTimes: JSON.stringify(["00:00"]),
            quietHoursStart: null,
            quietHoursEnd: null,
          },
        },
      },
    });

    const responses = await Promise.all(Array.from({ length: 5 }, () => GET(req())));
    expect(responses.every((r) => r.status === 200)).toBe(true);

    const logs = await prisma.reminderLog.findMany({ where: { studentProfileId: profile.id } });
    expect(logs).toHaveLength(1);

    // One row alone does not prove the LOCK worked -- the unique index
    // would also leave one row behind, by having the losing transaction
    // blow up (which the route catches and counts as a failure). The lock
    // is what makes the second transaction read the committed row and skip
    // cleanly, so: no failure was ever logged for this student.
    const failuresForThisStudent = errorSpy.mock.calls.filter((call) =>
      String(call[0]).includes(profile.id),
    );
    expect(failuresForThisStudent).toEqual([]);
  });
});
