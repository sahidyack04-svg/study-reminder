"use server";

import { prisma } from "@/lib/db/prisma";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { isWithinQuietHours } from "@/lib/notifications/quietHours";

const PHONE_PATTERN = /^\+\d{8,15}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const CHANNELS = ["none", "email", "whatsapp"] as const;

function isValidChannel(value: string): value is PreferencesView["channel"] {
  return (CHANNELS as readonly string[]).includes(value);
}

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
    // Rows predating this module (onboarding once offered a "browser"
    // channel) can hold a value outside the union. Blind-casting it left
    // /profile's radio group with nothing selected and the cron route with
    // a channel it cannot deliver on, so coerce anything unrecognised to
    // "none" -- the honest reading of "we are not reminding you on this".
    channel: isValidChannel(row.channel) ? row.channel : "none",
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
  // Every rejection below happens before any Prisma call, including the
  // profile lookup -- the same reject-before-you-touch-the-database shape
  // the WhatsApp checks already used. This function is the only writer of
  // ReminderPreference outside onboarding, so these are the guarantees the
  // cron route gets to rely on.
  if (!isValidChannel(input.channel)) {
    return { success: false, error: "Choose a valid reminder channel." };
  }

  if (input.channel === "whatsapp") {
    if (!input.whatsappConsentGiven) {
      return { success: false, error: "WhatsApp consent is required to use this channel." };
    }
    if (!input.phone || !PHONE_PATTERN.test(input.phone)) {
      return { success: false, error: "A valid phone number is required for WhatsApp." };
    }
  }

  // A channel with no preferred time can never fire: the cron route only
  // considers a student once the current time has reached one of their
  // preferred times, so an empty list means "never", silently and forever.
  if (input.channel !== "none") {
    if (input.preferredTimes.length === 0) {
      return {
        success: false,
        error: "Choose a preferred reminder time, or set your reminder channel to None.",
      };
    }
    if (!input.preferredTimes.every((time) => TIME_PATTERN.test(time))) {
      return { success: false, error: "Preferred reminder times must be a valid time (HH:mm)." };
    }
  }

  // A half-configured quiet-hours window is ignored outright by the cron
  // route, so saving one looks like it took effect and does nothing. Reject
  // the ambiguous shape instead of silently picking a meaning for it.
  const quietHoursStart = input.quietHoursStart || null;
  const quietHoursEnd = input.quietHoursEnd || null;
  if ((quietHoursStart === null) !== (quietHoursEnd === null)) {
    return {
      success: false,
      error: "Set both a quiet hours start and end, or leave both empty.",
    };
  }
  if (quietHoursStart !== null && quietHoursEnd !== null) {
    if (!TIME_PATTERN.test(quietHoursStart) || !TIME_PATTERN.test(quietHoursEnd)) {
      return { success: false, error: "Quiet hours must be a valid time (HH:mm)." };
    }
    // A preferred time sitting inside the quiet-hours window is suppressed
    // on every tick of every day -- the student would simply never hear
    // from us again. Checked with the same containment function the cron
    // route uses, so the two can never disagree about overnight windows.
    const suppressed = input.preferredTimes.find((time) =>
      isWithinQuietHours(time, quietHoursStart, quietHoursEnd),
    );
    if (suppressed) {
      return {
        success: false,
        error: `Your preferred reminder time (${suppressed}) falls inside your quiet hours (${quietHoursStart}–${quietHoursEnd}), so you would never be reminded. Pick a time outside that window.`,
      };
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
      quietHoursStart,
      quietHoursEnd,
      whatsappConsentGivenAt,
    },
    update: {
      channel: input.channel,
      preferredTimes: JSON.stringify(input.preferredTimes),
      phone: input.phone ?? null,
      quietHoursStart,
      quietHoursEnd,
      whatsappConsentGivenAt,
    },
  });

  return { success: true };
}
