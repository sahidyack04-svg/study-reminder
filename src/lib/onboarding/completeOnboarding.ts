"use server";

import { prisma } from "@/lib/db/prisma";
import { requiresGuardianConsent, todayInTimezone } from "@/lib/validation/age";
import { hasOverlap } from "@/lib/validation/timetable";
import { requestGuardianConsent } from "./guardianConsent";

export interface OnboardingInput {
  userId: string;
  name: string;
  dateOfBirth: string;
  grade: string;
  schoolName: string;
  curriculum: string;
  academicYear: string;
  gender?: string;
  timezone: string;
  subjects: string[];
  timetable: { dayOfWeek: number; subjectName?: string; startTime: string; endTime: string }[];
  availability: { dayOfWeek: number; startTime: string; endTime: string }[];
  goals: { description: string; examDate?: string; subjectName?: string }[];
  reminderChannel: "browser" | "email" | "whatsapp" | "none";
  preferredTimes: string[];
  phone?: string;
  guardian?: { name: string; email: string };
}

export interface OnboardingResult {
  success: boolean;
  error?: string;
  guardianConsentRequired?: boolean;
}

export async function completeOnboarding(input: OnboardingInput): Promise<OnboardingResult> {
  if (hasOverlap(input.timetable)) {
    return {
      success: false,
      error: "Your timetable has overlapping entries on the same day. Please fix them before continuing.",
    };
  }

  const dob = new Date(input.dateOfBirth);
  const guardianRequired = requiresGuardianConsent(dob, todayInTimezone(input.timezone));
  if (guardianRequired && !input.guardian) {
    return { success: false, error: "A guardian name and email are required for students under 18." };
  }

  try {
    const profile = await prisma.$transaction(async (tx) => {
      const created = await tx.studentProfile.create({
        data: {
          userId: input.userId,
          name: input.name,
          dateOfBirth: dob,
          grade: input.grade,
          schoolName: input.schoolName,
          curriculum: input.curriculum,
          academicYear: input.academicYear,
          gender: input.gender ?? null,
          timezone: input.timezone,
          onboardingCompletedAt: new Date(),
          subjects: { create: input.subjects.map((name, order) => ({ name, order })) },
          availabilityWindows: { create: input.availability },
          reminderPreference: {
            create: {
              channel: input.reminderChannel,
              preferredTimes: JSON.stringify(input.preferredTimes),
              phone: input.phone ?? null,
            },
          },
        },
        include: { subjects: true },
      });

      const subjectIdByName = new Map(created.subjects.map((s: { id: string; name: string }) => [s.name, s.id]));

      if (input.timetable.length) {
        await tx.timetableEntry.createMany({
          data: input.timetable.map((t) => ({
            studentProfileId: created.id,
            dayOfWeek: t.dayOfWeek,
            subjectId: t.subjectName ? subjectIdByName.get(t.subjectName) ?? null : null,
            startTime: t.startTime,
            endTime: t.endTime,
          })),
        });
      }

      if (input.goals.length) {
        await tx.goal.createMany({
          data: input.goals.map((g) => ({
            studentProfileId: created.id,
            subjectId: g.subjectName ? subjectIdByName.get(g.subjectName) ?? null : null,
            description: g.description,
            examDate: g.examDate ? new Date(g.examDate) : null,
          })),
        });
      }

      return created;
    });

    if (guardianRequired && input.guardian) {
      await requestGuardianConsent(profile.id, input.guardian);
    }

    return { success: true, guardianConsentRequired: guardianRequired };
  } catch {
    return { success: false, error: "Something went wrong. Please try again." };
  }
}
