import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    studentProfile: { findUnique: vi.fn() },
    planEntry: { findMany: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    task: { findMany: vi.fn(), update: vi.fn() },
    goal: { findMany: vi.fn() },
    availabilityWindow: { findMany: vi.fn() },
  },
}));
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
