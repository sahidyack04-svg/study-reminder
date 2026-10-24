"use server";

import { prisma } from "@/lib/db/prisma";
import { getCurrentSessionUser } from "@/lib/auth/session";

const PHONE_PATTERN = /^\+\d{8,15}$/;

export interface PreferencesView {
  channel: "none" | "email" | "whatsapp";
  preferredTimes: string[]; // "HH:mm"
  phone: string | null;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  whatsappConsentGiven: boolean;
}

export interface PreferencesInput {
  channel: "none" | "email" | "whatsapp";
  preferredTimes: string[];
  phone?: string | null;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  whatsappConsentGiven: boolean;
}

async function getOwnProfile() {
  const user = await getCurrentSessionUser();
  if (!user) return null;
  return prisma.studentProfile.findUnique({ where: { userId: user.id } });
}

export async function getPreferences(): Promise<PreferencesView | null> {
  const profile = await getOwnProfile();
  if (!profile) return null;

  const row = await prisma.reminderPreference.findUnique({
    where: { studentProfileId: profile.id },
  });
  if (!row) return null;

  return {
    channel: row.channel as PreferencesView["channel"],
    preferredTimes: JSON.parse(row.preferredTimes),
    phone: row.phone ?? null,
    quietHoursStart: row.quietHoursStart ?? null,
    quietHoursEnd: row.quietHoursEnd ?? null,
    whatsappConsentGiven: !!row.whatsappConsentGivenAt,
  };
}

export async function updatePreferences(
  input: PreferencesInput,
): Promise<{ success: boolean; error?: string }> {
  if (input.channel === "whatsapp") {
    if (!input.whatsappConsentGiven) {
      return { success: false, error: "WhatsApp consent is required to use this channel." };
    }
    if (!input.phone || !PHONE_PATTERN.test(input.phone)) {
      return { success: false, error: "A valid phone number is required for WhatsApp." };
    }
  }

  const profile = await getOwnProfile();
  if (!profile) {
    return { success: false, error: "You must be signed in to update notification preferences." };
  }

  const whatsappConsentGivenAt =
    input.channel === "whatsapp" && input.whatsappConsentGiven ? new Date() : null;

  await prisma.reminderPreference.upsert({
    where: { studentProfileId: profile.id },
    create: {
      studentProfileId: profile.id,
      channel: input.channel,
      preferredTimes: JSON.stringify(input.preferredTimes),
      phone: input.phone ?? null,
      quietHoursStart: input.quietHoursStart ?? null,
      quietHoursEnd: input.quietHoursEnd ?? null,
      whatsappConsentGivenAt,
    },
    update: {
      channel: input.channel,
      preferredTimes: JSON.stringify(input.preferredTimes),
      phone: input.phone ?? null,
      quietHoursStart: input.quietHoursStart ?? null,
      quietHoursEnd: input.quietHoursEnd ?? null,
      whatsappConsentGivenAt,
    },
  });

  return { success: true };
}
