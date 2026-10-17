import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    studentProfile: { findUnique: vi.fn() },
    journalEntry: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/auth/session", () => ({ getCurrentSessionUser: vi.fn() }));

import { prisma } from "@/lib/db/prisma";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { getTodayEntry, listPastEntries, saveJournalEntry } from "@/lib/journal/journal";

const sessionUser = { id: "u1", email: "s@example.test", emailVerified: new Date() };
const profile = { id: "p1", userId: "u1", timezone: "UTC" };

describe("getTodayEntry", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null with no session", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(null);
    expect(await getTodayEntry()).toBeNull();
  });

  it("returns null when no entry exists for today", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.journalEntry.findFirst as any).mockResolvedValue(null);
    expect(await getTodayEntry()).toBeNull();
  });

  it("returns today's entry scoped to the signed-in student's profile", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.journalEntry.findFirst as any).mockResolvedValue({ id: "j1", content: "Today's entry" });
    const result = await getTodayEntry();
    expect(result?.content).toBe("Today's entry");
    expect(prisma.journalEntry.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ studentProfileId: "p1" }) }),
    );
  });
});

describe("listPastEntries", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an empty list with no session", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(null);
    expect(await listPastEntries()).toEqual([]);
  });

  it("queries entries before today, ordered reverse chronological, scoped to the caller's profile", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.journalEntry.findMany as any).mockResolvedValue([{ id: "j0", content: "Yesterday" }]);
    const result = await listPastEntries();
    expect(result).toEqual([{ id: "j0", content: "Yesterday" }]);
    expect(prisma.journalEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ studentProfileId: "p1", date: expect.objectContaining({ lt: expect.any(Date) }) }),
        orderBy: { date: "desc" },
      }),
    );
  });
});

describe("saveJournalEntry", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects empty content without touching the database", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    const result = await saveJournalEntry("   ");
    expect(result.success).toBe(false);
    expect(prisma.journalEntry.create).not.toHaveBeenCalled();
    expect(prisma.journalEntry.update).not.toHaveBeenCalled();
  });

  it("creates a new entry for today when none exists yet", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.journalEntry.findFirst as any).mockResolvedValue(null);
    (prisma.journalEntry.create as any).mockResolvedValue({ id: "j1" });
    const result = await saveJournalEntry("Studied algebra.");
    expect(result.success).toBe(true);
    expect(prisma.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ studentProfileId: "p1", content: "Studied algebra." }) }),
    );
    expect(prisma.journalEntry.update).not.toHaveBeenCalled();
  });

  it("updates today's existing entry instead of creating a second one", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.journalEntry.findFirst as any).mockResolvedValue({ id: "j1", content: "old text" });
    (prisma.journalEntry.update as any).mockResolvedValue({ id: "j1" });
    const result = await saveJournalEntry("new text");
    expect(result.success).toBe(true);
    expect(prisma.journalEntry.update).toHaveBeenCalledWith({ where: { id: "j1" }, data: { content: "new text" } });
    expect(prisma.journalEntry.create).not.toHaveBeenCalled();
  });
});
