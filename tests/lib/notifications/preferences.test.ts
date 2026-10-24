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
