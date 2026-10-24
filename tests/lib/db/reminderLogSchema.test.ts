import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db/prisma";

describe("ReminderLog schema", () => {
  it("enforces one log row per student, date, and channel", async () => {
    const user = await prisma.user.create({
      data: { email: `reminder-${Date.now()}@example.test`, passwordHash: "x", emailVerified: new Date() },
    });
    const profile = await prisma.studentProfile.create({
      data: {
        userId: user.id, name: "Test Student", dateOfBirth: new Date("2010-01-01"),
        grade: "8", schoolName: "Test School", curriculum: "General", academicYear: "2026",
        timezone: "UTC",
      },
    });
    const date = new Date("2026-10-24T00:00:00.000Z");

    await prisma.reminderLog.create({
      data: { studentProfileId: profile.id, date, channel: "email", delivered: true },
    });

    await expect(
      prisma.reminderLog.create({
        data: { studentProfileId: profile.id, date, channel: "email", delivered: false },
      }),
    ).rejects.toThrow();
  });
});
