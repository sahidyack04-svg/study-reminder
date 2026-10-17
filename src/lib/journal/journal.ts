"use server";

import { prisma } from "@/lib/db/prisma";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { todayInTimezone } from "@/lib/validation/age";

export interface JournalEntryView {
  id: string;
  date: Date;
  content: string;
}

async function getOwnProfile() {
  const user = await getCurrentSessionUser();
  if (!user) return null;
  return prisma.studentProfile.findUnique({ where: { userId: user.id } });
}

export async function getTodayEntry(): Promise<JournalEntryView | null> {
  const profile = await getOwnProfile();
  if (!profile) return null;
  const today = todayInTimezone(profile.timezone);
  return prisma.journalEntry.findFirst({ where: { studentProfileId: profile.id, date: today } });
}

export async function listPastEntries(): Promise<JournalEntryView[]> {
  const profile = await getOwnProfile();
  if (!profile) return [];
  const today = todayInTimezone(profile.timezone);
  return prisma.journalEntry.findMany({
    where: { studentProfileId: profile.id, date: { lt: today } },
    orderBy: { date: "desc" },
  });
}

export async function saveJournalEntry(content: string): Promise<{ success: boolean; error?: string }> {
  if (!content.trim()) {
    return { success: false, error: "Journal entry cannot be empty." };
  }

  const profile = await getOwnProfile();
  if (!profile) {
    return { success: false, error: "You must be signed in to save a journal entry." };
  }

  const today = todayInTimezone(profile.timezone);
  const existing = await prisma.journalEntry.findFirst({ where: { studentProfileId: profile.id, date: today } });

  if (existing) {
    await prisma.journalEntry.update({ where: { id: existing.id }, data: { content: content.trim() } });
  } else {
    await prisma.journalEntry.create({
      data: { studentProfileId: profile.id, date: today, content: content.trim() },
    });
  }

  return { success: true };
}
