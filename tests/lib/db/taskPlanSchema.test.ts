import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import bcrypt from "bcryptjs";

describe("Task and PlanEntry schema", () => {
  const testEmail = `task-plan-schema-${Date.now()}@example.test`;
  let studentProfileId: string;

  afterAll(async () => {
    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    if (user) await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  });

  it("creates a user and student profile to attach tasks to", async () => {
    const passwordHash = await bcrypt.hash("schema-test-password", 12);
    const user = await prisma.user.create({ data: { email: testEmail, passwordHash, emailVerified: new Date() } });
    const profile = await prisma.studentProfile.create({
      data: {
        userId: user.id,
        name: "Schema Test",
        dateOfBirth: new Date("2008-01-01"),
        grade: "12",
        schoolName: "Test High",
        curriculum: "Test Board",
        academicYear: "2026-2027",
        timezone: "UTC",
      },
    });
    studentProfileId = profile.id;
    expect(studentProfileId).toBeTruthy();
  });

  it("creates and reads back a Task", async () => {
    const task = await prisma.task.create({
      data: {
        studentProfileId,
        title: "Finish algebra worksheet",
        dueDate: new Date("2026-11-01"),
        estimatedMinutes: 45,
      },
    });
    const found = await prisma.task.findUnique({ where: { id: task.id } });
    expect(found?.title).toBe("Finish algebra worksheet");
    expect(found?.status).toBe("open");
  });

  it("creates and reads back a PlanEntry linked to that Task", async () => {
    const task = await prisma.task.findFirstOrThrow({ where: { studentProfileId } });
    const entry = await prisma.planEntry.create({
      data: {
        studentProfileId,
        date: new Date("2026-11-01"),
        taskId: task.id,
        title: task.title,
        estimatedMinutes: task.estimatedMinutes,
      },
    });
    const found = await prisma.planEntry.findUnique({ where: { id: entry.id } });
    expect(found?.checkInStatus).toBe("pending");
    expect(found?.taskId).toBe(task.id);
  });
});
