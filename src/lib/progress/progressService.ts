"use server";

import { prisma } from "@/lib/db/prisma";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { todayInTimezone } from "@/lib/validation/age";
import { computeDailyCompletion, type CompletionPoint, type DayEntries } from "./completionChart";
import { computeTimeBySubject, type SubjectTimePoint } from "./subjectTimeChart";
import { computeStreak } from "./streak";

export interface ProgressData {
  completion: CompletionPoint[];
  subjectTime: SubjectTimePoint[];
  hasActivity: boolean;
}

async function getOwnProfile() {
  const user = await getCurrentSessionUser();
  if (!user) return null;
  return prisma.studentProfile.findUnique({ where: { userId: user.id } });
}

function groupByDate(entries: { date: Date; checkInStatus: string }[]): DayEntries[] {
  const byDate = new Map<string, DayEntries>();
  for (const entry of entries) {
    const key = entry.date.toISOString();
    const existing = byDate.get(key) ?? { date: entry.date, entries: [] };
    existing.entries.push({ checkInStatus: entry.checkInStatus });
    byDate.set(key, existing);
  }
  return Array.from(byDate.values());
}

export async function getProgressData(window: "week" | "month"): Promise<ProgressData> {
  const profile = await getOwnProfile();
  if (!profile) return { completion: [], subjectTime: [], hasActivity: false };

  const today = todayInTimezone(profile.timezone);
  const windowDays = window === "week" ? 7 : 30;
  const windowStart = new Date(today.getTime() - (windowDays - 1) * 24 * 60 * 60 * 1000);

  const entries = await prisma.planEntry.findMany({
    where: { studentProfileId: profile.id, date: { gte: windowStart } },
    include: { subject: true },
  });

  const completion = computeDailyCompletion(groupByDate(entries));
  const subjectTime = computeTimeBySubject(
    entries.map((e) => ({
      subjectId: e.subjectId,
      subjectName: e.subject?.name ?? null,
      estimatedMinutes: e.estimatedMinutes,
      checkInStatus: e.checkInStatus,
    })),
  );

  return { completion, subjectTime, hasActivity: entries.length > 0 };
}

export async function getCurrentStreak(): Promise<number> {
  const profile = await getOwnProfile();
  if (!profile) return 0;

  const today = todayInTimezone(profile.timezone);
  const lookbackStart = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);

  const entries = await prisma.planEntry.findMany({
    where: { studentProfileId: profile.id, date: { gte: lookbackStart } },
  });

  const byDate = groupByDate(entries);
  byDate.sort((a, b) => b.date.getTime() - a.date.getTime()); // today first

  return computeStreak(byDate);
}
