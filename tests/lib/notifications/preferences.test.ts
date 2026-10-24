// tests/lib/notifications/preferences.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    studentProfile: { findUnique: vi.fn() },
    reminderPreference: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));
vi.mock("@/lib/auth/session", () => ({ getCurrentSessionUser: vi.fn() }));

import { prisma } from "@/lib/db/prisma";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { getPreferences, updatePreferences } from "@/lib/notifications/preferences";

const sessionUser = { id: "u1", email: "s@example.test", emailVerified: new Date() };
const profile = { id: "p1", userId: "u1", timezone: "UTC" };

describe("getPreferences", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null with no session", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(null);
    expect(await getPreferences()).toBeNull();
  });

  it("decodes preferredTimes from JSON and exposes consent as a boolean", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.reminderPreference.findUnique as any).mockResolvedValue({
      channel: "whatsapp", preferredTimes: JSON.stringify(["18:00"]), phone: "+15551234567",
      quietHoursStart: "21:00", quietHoursEnd: "07:00", whatsappConsentGivenAt: new Date(),
    });
    const prefs = await getPreferences();
    expect(prefs?.preferredTimes).toEqual(["18:00"]);
    expect(prefs?.whatsappConsentGiven).toBe(true);
  });

  it("coerces a legacy 'browser' channel row to 'none' instead of returning a value outside the union", async () => {
    // Onboarding once offered a "browser" channel. Passing it through
    // unvalidated left /profile's radio group with nothing selected.
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.reminderPreference.findUnique as any).mockResolvedValue({
      channel: "browser", preferredTimes: JSON.stringify(["18:00"]), phone: null,
      quietHoursStart: null, quietHoursEnd: null, whatsappConsentGivenAt: null,
    });
    const prefs = await getPreferences();
    expect(prefs?.channel).toBe("none");
  });
});

describe("updatePreferences", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects setting channel to whatsapp without consent", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    const result = await updatePreferences({
      channel: "whatsapp", preferredTimes: ["18:00"], phone: "+15551234567", whatsappConsentGiven: false,
    });
    expect(result.success).toBe(false);
    expect(prisma.reminderPreference.upsert).not.toHaveBeenCalled();
  });

  it("rejects an invalid phone number when channel is whatsapp", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    const result = await updatePreferences({
      channel: "whatsapp", preferredTimes: ["18:00"], phone: "not-a-number", whatsappConsentGiven: true,
    });
    expect(result.success).toBe(false);
    expect(prisma.reminderPreference.upsert).not.toHaveBeenCalled();
  });

  it("clears whatsappConsentGivenAt when the channel is changed away from whatsapp", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    await updatePreferences({ channel: "email", preferredTimes: ["18:00"], whatsappConsentGiven: false });
    expect(prisma.reminderPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ whatsappConsentGivenAt: null }),
        update: expect.objectContaining({ whatsappConsentGivenAt: null }),
      }),
    );
  });

  it("rejects a channel outside the 'none' | 'email' | 'whatsapp' union", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    const result = await updatePreferences({
      channel: "browser" as any, preferredTimes: ["18:00"], whatsappConsentGiven: false,
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/valid reminder channel/i);
    expect(prisma.reminderPreference.upsert).not.toHaveBeenCalled();
  });

  // The three silent-non-delivery configurations: each one saves cleanly
  // today and means "never remind me again" without telling the student.
  it("rejects a non-'none' channel saved with no preferred time (would never fire)", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    const result = await updatePreferences({
      channel: "email", preferredTimes: [], whatsappConsentGiven: false,
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/preferred reminder time/i);
    expect(prisma.reminderPreference.upsert).not.toHaveBeenCalled();
  });

  it("rejects a half-configured quiet-hours window (only one of start/end set)", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    const startOnly = await updatePreferences({
      channel: "email", preferredTimes: ["18:00"], quietHoursStart: "21:00", quietHoursEnd: null,
      whatsappConsentGiven: false,
    });
    expect(startOnly.success).toBe(false);
    expect(startOnly.error).toMatch(/both a quiet hours start and end/i);

    const endOnly = await updatePreferences({
      channel: "email", preferredTimes: ["18:00"], quietHoursStart: null, quietHoursEnd: "07:00",
      whatsappConsentGiven: false,
    });
    expect(endOnly.success).toBe(false);
    expect(prisma.reminderPreference.upsert).not.toHaveBeenCalled();
  });

  it("rejects a preferred time that falls inside its own quiet-hours window", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);

    // Overnight window: 22:00 sits on the late side of 21:00-07:00, so
    // every tick at the preferred hour is suppressed, every day, forever.
    const overnight = await updatePreferences({
      channel: "email", preferredTimes: ["22:00"], quietHoursStart: "21:00", quietHoursEnd: "07:00",
      whatsappConsentGiven: false,
    });
    expect(overnight.success).toBe(false);
    expect(overnight.error).toMatch(/never be reminded/i);

    // Same-day window, same outcome.
    const sameDay = await updatePreferences({
      channel: "email", preferredTimes: ["12:00"], quietHoursStart: "09:00", quietHoursEnd: "17:00",
      whatsappConsentGiven: false,
    });
    expect(sameDay.success).toBe(false);
    expect(prisma.reminderPreference.upsert).not.toHaveBeenCalled();
  });

  it("still saves a valid configuration whose preferred time sits outside its quiet hours", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    const result = await updatePreferences({
      channel: "email", preferredTimes: ["18:00"], quietHoursStart: "21:00", quietHoursEnd: "07:00",
      whatsappConsentGiven: false,
    });
    expect(result.success).toBe(true);
    expect(prisma.reminderPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ quietHoursStart: "21:00", quietHoursEnd: "07:00" }),
      }),
    );
  });

  it("scopes the upsert to the signed-in student's own profile, not any id the caller might supply", async () => {
    const otherSessionUser = { id: "u2", email: "other@example.test", emailVerified: new Date() };
    const otherProfile = { id: "p2", userId: "u2", timezone: "UTC" };
    (getCurrentSessionUser as any).mockResolvedValue(otherSessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(otherProfile);
    await updatePreferences({ channel: "none", preferredTimes: [], whatsappConsentGiven: false });
    const call = (prisma.reminderPreference.upsert as any).mock.calls[0][0];
    expect(call.where.studentProfileId).toBe("p2");
    expect(call.create.studentProfileId).toBe("p2");
  });
});
