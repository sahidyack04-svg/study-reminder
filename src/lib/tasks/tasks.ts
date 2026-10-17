"use server";

import { prisma } from "@/lib/db/prisma";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { todayInTimezone } from "@/lib/validation/age";

export interface TaskView {
  id: string;
  title: string;
  subjectId: string | null;
  dueDate: Date | null;
  estimatedMinutes: number;
  status: string;
}

export interface CreateTaskInput {
  title: string;
  subjectId?: string | null;
  dueDate?: string;
  estimatedMinutes: number;
}

async function getOwnProfile() {
  const user = await getCurrentSessionUser();
  if (!user) return null;
  return prisma.studentProfile.findUnique({ where: { userId: user.id } });
}

export async function listTasks(): Promise<TaskView[]> {
  const profile = await getOwnProfile();
  if (!profile) return [];
  return prisma.task.findMany({
    where: { studentProfileId: profile.id },
    orderBy: { dueDate: "asc" },
  });
}

export async function createTask(
  input: CreateTaskInput,
): Promise<{ success: boolean; error?: string; task?: TaskView }> {
  if (!input.title.trim()) {
    return { success: false, error: "Title is required." };
  }
  if (!Number.isFinite(input.estimatedMinutes) || input.estimatedMinutes <= 0) {
    return { success: false, error: "Estimated minutes must be a positive number." };
  }

  const profile = await getOwnProfile();
  if (!profile) {
    return { success: false, error: "You must be signed in to add a task." };
  }

  if (input.subjectId && !(await assertOwnedSubject(input.subjectId, profile.id))) {
    return { success: false, error: "Subject not found." };
  }

  const task = await prisma.task.create({
    data: {
      studentProfileId: profile.id,
      title: input.title.trim(),
      subjectId: input.subjectId ?? null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      estimatedMinutes: input.estimatedMinutes,
    },
  });
  return { success: true, task };
}

async function assertOwnedTask(taskId: string, profileId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || task.studentProfileId !== profileId) {
    return null;
  }
  return task;
}

async function assertOwnedSubject(subjectId: string, profileId: string): Promise<boolean> {
  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  return !!subject && subject.studentProfileId === profileId;
}

export async function updateTask(
  taskId: string,
  changes: Partial<CreateTaskInput>,
): Promise<{ success: boolean; error?: string }> {
  const profile = await getOwnProfile();
  if (!profile) {
    return { success: false, error: "You must be signed in to update a task." };
  }

  const task = await assertOwnedTask(taskId, profile.id);
  if (!task) {
    return { success: false, error: "Task not found." };
  }

  if (changes.title !== undefined && !changes.title.trim()) {
    return { success: false, error: "Title is required." };
  }
  if (
    changes.estimatedMinutes !== undefined &&
    (!Number.isFinite(changes.estimatedMinutes) || changes.estimatedMinutes <= 0)
  ) {
    return { success: false, error: "Estimated minutes must be a positive number." };
  }
  if (changes.subjectId !== undefined && changes.subjectId !== null) {
    if (!(await assertOwnedSubject(changes.subjectId, profile.id))) {
      return { success: false, error: "Subject not found." };
    }
  }

  await prisma.task.update({
    where: { id: taskId },
    data: {
      ...(changes.title !== undefined && { title: changes.title.trim() }),
      ...(changes.subjectId !== undefined && { subjectId: changes.subjectId }),
      ...(changes.dueDate !== undefined && { dueDate: changes.dueDate ? new Date(changes.dueDate) : null }),
      ...(changes.estimatedMinutes !== undefined && { estimatedMinutes: changes.estimatedMinutes }),
    },
  });
  return { success: true };
}

export async function deleteTask(taskId: string): Promise<{ success: boolean; error?: string }> {
  const profile = await getOwnProfile();
  if (!profile) {
    return { success: false, error: "You must be signed in to delete a task." };
  }

  const task = await assertOwnedTask(taskId, profile.id);
  if (!task) {
    return { success: false, error: "Task not found." };
  }

  await prisma.task.delete({ where: { id: taskId } });
  return { success: true };
}

export async function markTaskDone(taskId: string): Promise<{ success: boolean; error?: string }> {
  const profile = await getOwnProfile();
  if (!profile) {
    return { success: false, error: "You must be signed in to update a task." };
  }

  const task = await assertOwnedTask(taskId, profile.id);
  if (!task) {
    return { success: false, error: "Task not found." };
  }

  await prisma.task.update({ where: { id: taskId }, data: { status: "done" } });
  const today = todayInTimezone(profile.timezone);
  await prisma.planEntry.updateMany({
    where: { taskId, studentProfileId: profile.id, checkInStatus: "pending", date: today },
    data: { checkInStatus: "done" },
  });
  return { success: true };
}
