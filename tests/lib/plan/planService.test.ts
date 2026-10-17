import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => {
  const prisma: any = {
    studentProfile: { findUnique: vi.fn() },
    planEntry: { findMany: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    task: { findMany: vi.fn(), update: vi.fn() },
    goal: { findMany: vi.fn() },
    availabilityWindow: { findMany: vi.fn() },
    $transaction: vi.fn(),
  };
  // The real $transaction wraps a check-then-write sequence so SQLite can
  // serialize concurrent callers. For tests, `tx` is just `prisma` itself —
  // we only care that the right calls happen in the right order, not that
  // tx is a distinct client.
  prisma.$transaction.mockImplementation((callback: any) => callback(prisma));
  return { prisma };
});
vi.mock("@/lib/auth/session", () => ({ getCurrentSessionUser: vi.fn() }));

import { prisma } from "@/lib/db/prisma";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { getOrGeneratePlanForDate, checkInPlanEntry } from "@/lib/plan/planService";

const sessionUser = { id: "u1", email: "s@example.test", emailVerified: new Date() };
const profile = { id: "p1", userId: "u1", timezone: "UTC" };

describe("getOrGeneratePlanForDate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an empty plan with no session", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(null);
    const result = await getOrGeneratePlanForDate();
    expect(result.entries).toEqual([]);
    expect(result.capacityMinutes).toBe(0);
  });

  it("returns existing entries for today without regenerating", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.planEntry.findMany as any).mockResolvedValueOnce([{ id: "e1", title: "Existing entry" }]);
    (prisma.availabilityWindow.findMany as any).mockResolvedValue([]); // capacity is still computed for the UI
    const result = await getOrGeneratePlanForDate();
    expect(result.entries).toEqual([{ id: "e1", title: "Existing entry" }]);
    expect(prisma.planEntry.create).not.toHaveBeenCalled();
  });

  it("generates and persists entries for a day with zero existing entries and zero availability", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.planEntry.findMany as any)
      .mockResolvedValueOnce([]) // today's existing entries: none
      .mockResolvedValueOnce([]); // yesterday's entries for carry-forward: none
    (prisma.availabilityWindow.findMany as any).mockResolvedValue([]); // no availability this weekday
    (prisma.task.findMany as any).mockResolvedValue([]);
    (prisma.goal.findMany as any).mockResolvedValue([]);

    const result = await getOrGeneratePlanForDate();
    expect(result.capacityMinutes).toBe(0);
    expect(result.entries).toEqual([]);
    expect(prisma.planEntry.create).not.toHaveBeenCalled();
  });

  it("persists a generated entry built from an open task and real availability", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.planEntry.findMany as any).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    (prisma.availabilityWindow.findMany as any).mockResolvedValue([
      { dayOfWeek: 0, startTime: "17:00", endTime: "18:00" },
    ]);
    (prisma.task.findMany as any).mockResolvedValue([
      { id: "t1", subjectId: null, title: "Reading", dueDate: null, estimatedMinutes: 30 },
    ]);
    (prisma.goal.findMany as any).mockResolvedValue([]);
    (prisma.planEntry.create as any).mockResolvedValue({ id: "new-entry" });

    await getOrGeneratePlanForDate();
    expect(prisma.planEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ studentProfileId: "p1", taskId: "t1", estimatedMinutes: 30 }),
      }),
    );
  });

  it("does not carry forward a partial entry whose task was already marked done outside the plan", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.planEntry.findMany as any)
      .mockResolvedValueOnce([]) // today's existing entries: none
      .mockResolvedValueOnce([
        { id: "y1", taskId: "t1", subjectId: null, title: "Reading", estimatedMinutes: 30, checkInStatus: "partial" },
      ]); // yesterday's entries: a partial entry for a task that is no longer open
    (prisma.availabilityWindow.findMany as any).mockResolvedValue([
      { dayOfWeek: 0, startTime: "17:00", endTime: "18:00" },
    ]);
    // The task behind yesterday's partial entry is now done, so it does not
    // come back from the "open" query — it must not be resurrected.
    (prisma.task.findMany as any).mockResolvedValue([]);
    (prisma.goal.findMany as any).mockResolvedValue([]);

    const result = await getOrGeneratePlanForDate();
    expect(
      (result.entries as { taskId?: string | null }[]).some((e) => e.taskId === "t1"),
    ).toBe(false);
    expect(prisma.planEntry.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ taskId: "t1" }) }),
    );
  });

  it("carries forward a partial entry when its task is still open", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.planEntry.findMany as any)
      .mockResolvedValueOnce([]) // today's existing entries: none
      .mockResolvedValueOnce([
        { id: "y1", taskId: "t1", subjectId: null, title: "Reading", estimatedMinutes: 30, checkInStatus: "partial" },
      ]); // yesterday's entries: a partial entry for a task that is still open
    (prisma.availabilityWindow.findMany as any).mockResolvedValue([
      { dayOfWeek: 0, startTime: "17:00", endTime: "18:00" },
    ]);
    (prisma.task.findMany as any).mockResolvedValue([
      { id: "t1", subjectId: null, title: "Reading", dueDate: null, estimatedMinutes: 30, status: "open" },
    ]);
    (prisma.goal.findMany as any).mockResolvedValue([]);
    (prisma.planEntry.create as any).mockResolvedValue({ id: "new-entry" });

    await getOrGeneratePlanForDate();
    expect(prisma.planEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ taskId: "t1", carriedOverFromDate: expect.anything() }),
      }),
    );
  });
});

describe("checkInPlanEntry", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuses to update an entry belonging to a different student", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.planEntry.findUnique as any).mockResolvedValue({ id: "e1", studentProfileId: "someone-elses-profile" });
    const result = await checkInPlanEntry("e1", "done");
    expect(result.success).toBe(false);
    expect(prisma.planEntry.update).not.toHaveBeenCalled();
  });

  it("marks an entry done and syncs its task when it has one", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.planEntry.findUnique as any).mockResolvedValue({ id: "e1", studentProfileId: "p1", taskId: "t1" });
    const result = await checkInPlanEntry("e1", "done");
    expect(result.success).toBe(true);
    expect(prisma.planEntry.update).toHaveBeenCalledWith({ where: { id: "e1" }, data: { checkInStatus: "done" } });
    expect(prisma.task.update).toHaveBeenCalledWith({ where: { id: "t1" }, data: { status: "done" } });
  });

  it("marks an entry not_done without touching its task", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.planEntry.findUnique as any).mockResolvedValue({ id: "e1", studentProfileId: "p1", taskId: "t1" });
    const result = await checkInPlanEntry("e1", "not_done");
    expect(result.success).toBe(true);
    expect(prisma.planEntry.update).toHaveBeenCalledWith({ where: { id: "e1" }, data: { checkInStatus: "not_done" } });
    expect(prisma.task.update).not.toHaveBeenCalled();
  });
});
