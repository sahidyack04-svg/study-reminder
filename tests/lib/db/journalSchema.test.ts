import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import bcrypt from "bcryptjs";

describe("JournalEntry schema", () => {
  const testEmail = `journal-schema-${Date.now()}@example.test`;

  afterAll(async () => {
    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    if (user) await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  });

  it("creates and reads back a JournalEntry scoped to a student profile", async () => {
    const passwordHash = await bcrypt.hash("schema-test-password", 12);
    const user = await prisma.user.create({ data: { email: testEmail, passwordHash, emailVerified: new Date() } });
    const profile = await prisma.studentProfile.create({
      data: {
        userId: user.id,
        name: "Journal Schema Test",
        dateOfBirth: new Date("2008-01-01"),
        grade: "12",
        schoolName: "Test High",
        curriculum: "Test Board",
        academicYear: "2026-2027",
        timezone: "UTC",
      },
    });

    const entry = await prisma.journalEntry.create({
      data: { studentProfileId: profile.id, date: new Date("2026-10-17"), content: "Studied algebra today." },
    });
    const found = await prisma.journalEntry.findUnique({ where: { id: entry.id } });
    expect(found?.content).toBe("Studied algebra today.");
    expect(found?.studentProfileId).toBe(profile.id);
  });
});
