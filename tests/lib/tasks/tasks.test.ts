import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    studentProfile: { findUnique: vi.fn() },
    task: { findMany: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    planEntry: { updateMany: vi.fn() },
    subject: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/auth/session", () => ({ getCurrentSessionUser: vi.fn() }));

import { prisma } from "@/lib/db/prisma";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { listTasks, createTask, updateTask, deleteTask, markTaskDone } from "@/lib/tasks/tasks";

const sessionUser = { id: "u1", email: "s@example.test", emailVerified: new Date() };
const profile = { id: "p1", userId: "u1" };

describe("listTasks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an empty list with no session", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(null);
    expect(await listTasks()).toEqual([]);
  });

  it("returns only the signed-in student's tasks", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.task.findMany as any).mockResolvedValue([{ id: "t1", title: "Essay" }]);
    const result = await listTasks();
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { studentProfileId: "p1" } }),
    );
    expect(result).toEqual([{ id: "t1", title: "Essay" }]);
  });
});

describe("createTask", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a blank title without touching the database", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    const result = await createTask({ title: "  ", estimatedMinutes: 30 });
    expect(result.success).toBe(false);
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it("rejects a non-positive estimated duration", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    const result = await createTask({ title: "Essay", estimatedMinutes: 0 });
    expect(result.success).toBe(false);
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it("creates a task scoped to the signed-in student's profile", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.task.create as any).mockResolvedValue({ id: "t1" });
    const result = await createTask({ title: "Essay", estimatedMinutes: 30, dueDate: "2026-11-01" });
    expect(result.success).toBe(true);
    expect(prisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ studentProfileId: "p1", title: "Essay" }) }),
    );
  });

  it("rejects a subjectId belonging to a different profile without creating the task", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.subject.findUnique as any).mockResolvedValue({ id: "s1", studentProfileId: "someone-elses-profile" });
    const result = await createTask({ title: "Essay", estimatedMinutes: 30, subjectId: "s1" });
    expect(result.success).toBe(false);
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it("creates a task when subjectId legitimately belongs to the caller", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.subject.findUnique as any).mockResolvedValue({ id: "s1", studentProfileId: "p1" });
    (prisma.task.create as any).mockResolvedValue({ id: "t1" });
    const result = await createTask({ title: "Essay", estimatedMinutes: 30, subjectId: "s1" });
    expect(result.success).toBe(true);
    expect(prisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ subjectId: "s1" }) }),
    );
  });
});

describe("updateTask / deleteTask / markTaskDone — cross-student protection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updateTask refuses to modify a task belonging to a different student", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.task.findUnique as any).mockResolvedValue({ id: "t1", studentProfileId: "someone-elses-profile" });
    const result = await updateTask("t1", { title: "Hijacked" });
    expect(result.success).toBe(false);
    expect(prisma.task.update).not.toHaveBeenCalled();
  });

  it("deleteTask refuses to delete a task belonging to a different student", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.task.findUnique as any).mockResolvedValue({ id: "t1", studentProfileId: "someone-elses-profile" });
    const result = await deleteTask("t1");
    expect(result.success).toBe(false);
    expect(prisma.task.delete).not.toHaveBeenCalled();
  });

  it("markTaskDone refuses a task belonging to a different student", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.task.findUnique as any).mockResolvedValue({ id: "t1", studentProfileId: "someone-elses-profile" });
    const result = await markTaskDone("t1");
    expect(result.success).toBe(false);
    expect(prisma.task.update).not.toHaveBeenCalled();
  });
});

describe("updateTask — input validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a blank title without calling prisma.task.update", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.task.findUnique as any).mockResolvedValue({ id: "t1", studentProfileId: "p1" });
    const result = await updateTask("t1", { title: "   " });
    expect(result.success).toBe(false);
    expect(prisma.task.update).not.toHaveBeenCalled();
  });

  it("rejects a non-positive estimatedMinutes without calling prisma.task.update", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.task.findUnique as any).mockResolvedValue({ id: "t1", studentProfileId: "p1" });
    const result = await updateTask("t1", { estimatedMinutes: 0 });
    expect(result.success).toBe(false);
    expect(prisma.task.update).not.toHaveBeenCalled();
  });

  it("allows a valid partial update that only touches dueDate", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.task.findUnique as any).mockResolvedValue({ id: "t1", studentProfileId: "p1" });
    (prisma.task.update as any).mockResolvedValue({ id: "t1" });
    const result = await updateTask("t1", { dueDate: "2026-12-01" });
    expect(result.success).toBe(true);
    expect(prisma.task.update).toHaveBeenCalled();
  });

  it("rejects a subjectId belonging to a different profile without calling prisma.task.update", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.task.findUnique as any).mockResolvedValue({ id: "t1", studentProfileId: "p1" });
    (prisma.subject.findUnique as any).mockResolvedValue({ id: "s1", studentProfileId: "someone-elses-profile" });
    const result = await updateTask("t1", { subjectId: "s1" });
    expect(result.success).toBe(false);
    expect(prisma.task.update).not.toHaveBeenCalled();
  });

  it("allows updating subjectId when it legitimately belongs to the caller", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.task.findUnique as any).mockResolvedValue({ id: "t1", studentProfileId: "p1" });
    (prisma.subject.findUnique as any).mockResolvedValue({ id: "s1", studentProfileId: "p1" });
    (prisma.task.update as any).mockResolvedValue({ id: "t1" });
    const result = await updateTask("t1", { subjectId: "s1" });
    expect(result.success).toBe(true);
    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ subjectId: "s1" }) }),
    );
  });
});

describe("markTaskDone — plan entry sync", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks the task done and syncs any pending plan entries for it", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.task.findUnique as any).mockResolvedValue({ id: "t1", studentProfileId: "p1" });
    (prisma.task.update as any).mockResolvedValue({ id: "t1", status: "done" });
    const result = await markTaskDone("t1");
    expect(result.success).toBe(true);
    expect(prisma.task.update).toHaveBeenCalledWith({ where: { id: "t1" }, data: { status: "done" } });
    expect(prisma.planEntry.updateMany).toHaveBeenCalledWith({
      where: { taskId: "t1", checkInStatus: "pending" },
      data: { checkInStatus: "done" },
    });
  });
});
