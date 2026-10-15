"use server";

import { prisma } from "@/lib/db/prisma";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { todayInTimezone } from "@/lib/validation/age";
import { toMinutes } from "@/lib/validation/timetable";
import { generatePlanEntries } from "./generatePlan";

export interface PlanDayView {
  entries: unknown[];
  capacityMinutes: number;
}

async function getOwnProfile() {
  const user = await getCurrentSessionUser();
  if (!user) return null;
  return prisma.studentProfile.findUnique({ where: { userId: user.id } });
}

function previousDate(date: Date): Date {
  return new Date(date.getTime() - 24 * 60 * 60 * 1000);
}

export async function getOrGeneratePlanForDate(): Promise<PlanDayView> {
  const profile = await getOwnProfile();
  if (!profile) return { entries: [], capacityMinutes: 0 };

  const today = todayInTimezone(profile.timezone);

  const existing = await prisma.planEntry.findMany({
    where: { studentProfileId: profile.id, date: today },
  });
  if (existing.length > 0) {
    const capacity = await capacityForDate(profile.id, today);
    return { entries: existing, capacityMinutes: capacity };
  }

  const capacityMinutes = await capacityForDate(profile.id, today);

  const yesterday = previousDate(today);
  const yesterdayEntries = await prisma.planEntry.findMany({
    where: { studentProfileId: profile.id, date: yesterday },
  });
  const carryForward = yesterdayEntries
    .filter((e) => e.taskId && (e.checkInStatus === "partial" || e.checkInStatus === "not_done"))
    .map((e) => ({
      taskId: e.taskId as string,
      subjectId: e.subjectId,
      title: e.title,
      estimatedMinutes: e.estimatedMinutes,
      fromDate: yesterday,
    }));
  const carryForwardTaskIds = new Set(carryForward.map((c) => c.taskId));

  const openTasks = (
    await prisma.task.findMany({ where: { studentProfileId: profile.id, status: "open" } })
  ).filter((t) => !carryForwardTaskIds.has(t.id));

  const fourteenDaysOut = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
  const openTaskGoalIds = new Set(
    (await prisma.task.findMany({ where: { studentProfileId: profile.id, status: "open" } }))
      .map((t) => t.subjectId)
      .filter((id): id is string => !!id),
  );
  const eligibleGoals = (
    await prisma.goal.findMany({
      where: { studentProfileId: profile.id, examDate: { not: null, lte: fourteenDaysOut, gte: today } },
      orderBy: { examDate: "asc" },
    })
  ).filter((g) => !g.subjectId || !openTaskGoalIds.has(g.subjectId));

  const generated = generatePlanEntries({
    capacityMinutes,
    carryForward,
    openTasks: openTasks.map((t) => ({
      id: t.id,
      subjectId: t.subjectId,
      title: t.title,
      dueDate: t.dueDate,
      estimatedMinutes: t.estimatedMinutes,
    })),
    eligibleGoals: eligibleGoals.map((g) => ({ id: g.id, subjectId: g.subjectId, description: g.description })),
  });

  const created = [];
  for (const entry of generated) {
    const row = await prisma.planEntry.create({
      data: {
        studentProfileId: profile.id,
        date: today,
        taskId: entry.taskId,
        goalId: entry.goalId,
        subjectId: entry.subjectId,
        title: entry.title,
        estimatedMinutes: entry.estimatedMinutes,
        carriedOverFromDate: entry.carriedOverFromDate,
      },
    });
    created.push(row);
  }

  return { entries: created, capacityMinutes };
}

async function capacityForDate(studentProfileId: string, date: Date): Promise<number> {
  const windows = await prisma.availabilityWindow.findMany({
    where: { studentProfileId, dayOfWeek: date.getUTCDay() },
  });
  return windows.reduce((sum, w) => sum + (toMinutes(w.endTime) - toMinutes(w.startTime)), 0);
}

export async function checkInPlanEntry(
  entryId: string,
  status: "done" | "partial" | "not_done",
): Promise<{ success: boolean; error?: string }> {
  const profile = await getOwnProfile();
  if (!profile) {
    return { success: false, error: "You must be signed in." };
  }

  const entry = await prisma.planEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.studentProfileId !== profile.id) {
    return { success: false, error: "Plan entry not found." };
  }

  await prisma.planEntry.update({ where: { id: entryId }, data: { checkInStatus: status } });

  if (status === "done" && entry.taskId) {
    await prisma.task.update({ where: { id: entry.taskId }, data: { status: "done" } });
  }

  return { success: true };
}
