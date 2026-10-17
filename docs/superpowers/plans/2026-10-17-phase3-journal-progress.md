# Phase 3 — Journal & Dashboard Progress Charts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give students a private daily journal and a real `/progress` page with three data visualizations (daily completion, planned-vs-actual time by subject, check-in streak) built entirely from Phase 2's real data.

**Architecture:** One new Prisma model (`JournalEntry`), three pure calculation functions (no I/O) feeding two hand-rolled inline-SVG charts plus one stat tile, a thin session-scoped data-layer wrapper per Phase 2's established pattern, and two new pages plus a dashboard integration — following the exact file/task shape Phase 2 used.

**Tech Stack:** Same as Phases 1-2 — Next.js 15 (App Router) · TypeScript · Prisma (`sqlite`) · Vitest + Testing Library. No new dependencies; charts are hand-rolled SVG (see "Chart design decisions" below), not a charting library.

**Spec:** `docs/superpowers/specs/2026-10-17-phase3-journal-progress-design.md`

## Chart design decisions (made during planning, binding on implementers)

This project's `dataviz` skill was consulted before writing this plan. Two color decisions were validated with the skill's `scripts/validate_palette.js` and must be used verbatim — do not substitute the app's decorative pastel `pink`/`lavender` Tailwind tokens for data-encoding colors; they fail the skill's categorical-palette validator (too light, too low chroma, CVD-unsafe) when tested directly.

- **Categorical pair (Planned vs. Actual, time-by-subject chart):** `--series-planned: #4a3aa7` (violet), `--series-actual: #e87ba4` (magenta). Validated: `node validate_palette.js "#e87ba4,#4a3aa7" --mode light` → ALL CHECKS PASS (lightness band, chroma floor, CVD separation ΔE 24.9, normal-vision floor ΔE 33.9). One WARN: magenta's contrast vs. a light surface is below 3:1 — the skill's mitigation is visible direct labels, which this plan's bar chart already provides (a numeric label on/beside every bar), so the WARN is satisfied, not ignored.
- **Sequential encoding (daily completion %):** a single hue, the same magenta `#e87ba4`, encoded via fill-opacity scaled by value (15% opacity floor at 0%, 100% opacity at 100%) against the chart's cream/white surface — this is "one hue, light→dark" by construction (lower value reads lighter/closer to the surface, higher value reads darker/fuller), keeps the two charts visually cohesive (same hue family), and needs no separate multi-stop ramp validation since the sequential check is lightness-monotonicity, which opacity scaling against a fixed-lightness surface satisfies by definition.
- **Chrome/ink:** reuse the app's existing `text-slate-600`/`text-slate-500` and `bg-white`/`shadow-sm` conventions already used throughout Phases 1-2 — do not introduce the dataviz skill's separate gray chrome tokens; this app's existing neutral-ink conventions already satisfy the same readability goal and keep visual consistency with every other page.
- **Accessibility, per the skill's six-check pass:** both charts get (a) a visible legend when ≥2 series (time-by-subject chart only — the completion chart is a single series and needs none, per the skill's own rule), (b) a direct numeric label on every bar (satisfies both "selective direct labels" and the magenta contrast WARN's mitigation), (c) a native SVG `<title>` element per bar as a lightweight hover tooltip (zero extra dependencies), (d) a visually-hidden (`sr-only`) `<table>` alongside each chart's SVG, containing the same data in plain text/numbers, satisfying "a table view exists" for screen-reader users. Dark mode is explicitly out of scope — this app has no dark mode anywhere (confirmed: no theme toggle, no `prefers-color-scheme` handling in any existing page), so skip the skill's dark-mode validation step entirely; this is a deliberate single-theme commitment, not an oversight.
- **No dual-axis charts.** The time-by-subject chart's two series (Planned, Actual) share one unit (minutes) and one scale — paired bars, not two axes.

## Global Constraints

- Every student-owned row (`JournalEntry`) is scoped by `studentProfileId` → `userId`; every server action resolves the acting user via `getCurrentSessionUser()`, never trusts a client-supplied id — identical discipline to every Phase 1/2 data module.
- Calendar-day dates (`JournalEntry.date`) are UTC-midnight-anchored and read with UTC getters, exactly like `PlanEntry.date` (see Phase 2's Global Constraints, inherited unchanged). "Today" comes from `todayInTimezone(timezone)`, never a bare `new Date()`.
- A day with zero `PlanEntry` rows is excluded from the daily completion chart (not plotted as 0%) and does not break the check-in streak (skipped, not counted as failure).
- The check-in streak is **not** limited by the `/progress` page's Week/Month toggle — it is a continuous value computed by walking backward through full history (bounded at a 365-day lookback for query sanity), independent of which window the two charts are currently displaying. *(Plan-level clarification: the spec's "a Week/Month toggle controls the window for all three pieces below" is read as "displayed together on one page," not as "the streak's own math is capped at 7/30 days" — a streak artificially truncated by a display filter would be confusing and wrong. This is the one place this plan disambiguates spec wording rather than quoting it verbatim.)*
- "Planned minutes" per subject = sum of `estimatedMinutes` across ALL that subject's `PlanEntry` rows in the window, any status. "Actual minutes" = sum of `estimatedMinutes` across only `checkInStatus === "done"` rows. `partial`/`not_done` rows count toward Planned, never toward Actual. `PlanEntry` rows with a null `subjectId` are excluded from this chart entirely.
- No fabricated data: an empty window shows an explicit "No study activity yet" message, never a zero-filled or placeholder chart.

## Review Focus

- **Journal reads/writes must be scoped to the caller's own profile with no id-based attack surface at all** — unlike Phase 2's `updateTask(taskId, ...)`/`deleteTask(taskId)` (which take a client-supplied id and need an ownership check that could in principle be bypassed), `getTodayEntry()`/`listPastEntries()`/`saveJournalEntry(content)` take **no id parameter whatsoever** — every query derives its target exclusively from the session-resolved profile, so there is no id a caller could substitute to reach another student's entry. Task 2's tests verify this the only way that's meaningful for a no-id-parameter design: asserting every Prisma call is scoped by `studentProfileId: profile.id` from the resolved session, and that no session means no data (`null`/`[]`), never another profile's data.
- **A day has `PlanEntry` rows but they were never checked in (all still `pending`)** — must NOT count as a streak day and must END the streak walk (unless that day is today, see the next item), and must still be included in the completion chart at `0%` (it has entries, so it is NOT excluded the way a zero-entry day is). Covered in Task 3 (`streak.test.ts`, `completionChart.test.ts`).
- **Today has `PlanEntry` rows with some still `pending`** — must be excluded from the streak count without ending the streak (the day isn't over yet); the walk continues from yesterday as if today had been skipped, not as if today had broken the streak. Covered in Task 3 (`streak.test.ts`) — this is the subtlest rule in the spec and the one most likely to be implemented backwards (excluded-not-broken vs. broken).
- **A subject has only `partial`/`not_done` `PlanEntry` rows in the window, never `done`** — the time-by-subject chart must show nonzero Planned minutes and exactly zero Actual minutes for that subject, not omit the subject or show equal values. Covered in Task 3 (`subjectTimeChart.test.ts`).
- **The window (Week or Month) has zero `PlanEntry` activity at all** — both charts must render an explicit "no activity yet" message, and the streak must show `0` as a genuine answer, not an error state or a hidden/blank section. Covered in Task 4 (`progressService.test.ts`) and Task 6 (`progress-view.test.tsx`).

---

## File Structure

```
study reminder/
├── prisma/
│   └── schema.prisma                       (modified: + JournalEntry model)
├── src/
│   ├── lib/
│   │   ├── journal/
│   │   │   └── journal.ts                  (getTodayEntry, listPastEntries, saveJournalEntry)
│   │   └── progress/
│   │       ├── completionChart.ts          (pure: computeDailyCompletion)
│   │       ├── subjectTimeChart.ts         (pure: computeTimeBySubject)
│   │       ├── streak.ts                   (pure: computeStreak)
│   │       └── progressService.ts          (DB wrapper: getProgressData, getCurrentStreak)
│   └── app/
│       ├── journal/
│       │   ├── page.tsx                    (server component)
│       │   └── JournalView.tsx             (client component)
│       ├── progress/
│       │   ├── page.tsx                    (server component)
│       │   ├── ProgressView.tsx            (client component: Week/Month toggle + layout)
│       │   ├── CompletionChart.tsx         (SVG bar chart, sequential)
│       │   └── SubjectTimeChart.tsx        (SVG paired-bar chart, categorical)
│       └── dashboard/page.tsx              (modified: real "Progress reports" summary)
└── tests/
    ├── lib/
    │   ├── journal/journal.test.ts
    │   └── progress/
    │       ├── completionChart.test.ts
    │       ├── subjectTimeChart.test.ts
    │       ├── streak.test.ts
    │       └── progressService.test.ts
    └── app/
        ├── journal-view.test.tsx
        └── progress-view.test.tsx
```

---

### Task 1: Database schema — `JournalEntry` model

**Files:**
- Modify: `prisma/schema.prisma`
- Test: `tests/lib/db/journalSchema.test.ts`

**Interfaces:**
- Produces: `JournalEntry` Prisma model, queryable via the existing `prisma` singleton from `@/lib/db/prisma`.

- [ ] **Step 1: Add the model to the schema**

Add to `prisma/schema.prisma`:

```prisma
model JournalEntry {
  id               String   @id @default(cuid())
  studentProfileId String
  date             DateTime // UTC-midnight-anchored calendar date
  content          String
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  studentProfile StudentProfile @relation(fields: [studentProfileId], references: [id], onDelete: Cascade)

  @@index([studentProfileId, date])
}
```

Add one line to the existing `StudentProfile` model's relations block (alongside `tasks Task[]` / `planEntries PlanEntry[]` from Phase 2):
```prisma
  journalEntries      JournalEntry[]
```

- [ ] **Step 2: Run the migration**

Run: `npx prisma migrate dev --name add_journal_entry`
Expected: creates a new migration folder, applies it to `prisma/dev.db`, regenerates the Prisma client. No errors.

- [ ] **Step 3: Write the failing smoke test**

`tests/lib/db/journalSchema.test.ts`:
```typescript
import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import bcrypt from "bcryptjs";

describe("JournalEntry schema", () => {
  const testEmail = `journal-schema-${Date.now()}@example.test`;

  afterAll(async () => {
    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    if (user) await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  });

  it("creates and reads back a JournalEntry scoped to a student profile", async () => {
    const passwordHash = await bcrypt.hash("schema-test-password", 12);
    const user = await prisma.user.create({ data: { email: testEmail, passwordHash, emailVerified: new Date() } });
    const profile = await prisma.studentProfile.create({
      data: {
        userId: user.id,
        name: "Journal Schema Test",
        dateOfBirth: new Date("2008-01-01"),
        grade: "12",
        schoolName: "Test High",
        curriculum: "Test Board",
        academicYear: "2026-2027",
        timezone: "UTC",
      },
    });

    const entry = await prisma.journalEntry.create({
      data: { studentProfileId: profile.id, date: new Date("2026-10-17"), content: "Studied algebra today." },
    });
    const found = await prisma.journalEntry.findUnique({ where: { id: entry.id } });
    expect(found?.content).toBe("Studied algebra today.");
    expect(found?.studentProfileId).toBe(profile.id);
  });
});
```

- [ ] **Step 4: Run and verify pass**

Run: `npx vitest run tests/lib/db/journalSchema.test.ts`
Expected: PASS (1/1)

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations tests/lib/db/journalSchema.test.ts
git commit -m "feat: add JournalEntry schema"
```

---

### Task 2: Journal library

**Files:**
- Create: `src/lib/journal/journal.ts`
- Test: `tests/lib/journal/journal.test.ts`

**Interfaces:**
- Consumes: `getCurrentSessionUser()` from `@/lib/auth/session`, `todayInTimezone` from `@/lib/validation/age`, `prisma` from `@/lib/db/prisma`.
- Produces: `getTodayEntry(): Promise<JournalEntryView | null>`, `listPastEntries(): Promise<JournalEntryView[]>`, `saveJournalEntry(content: string): Promise<{success: boolean; error?: string}>` from `@/lib/journal/journal`, used by Task 5's `/journal` page.

- [ ] **Step 1: Write failing tests**

`tests/lib/journal/journal.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run and verify failure**

Run: `npx vitest run tests/lib/journal/journal.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/journal/journal.ts`:
```typescript
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
```

- [ ] **Step 4: Run and verify pass**

Run: `npx vitest run tests/lib/journal/journal.test.ts`
Expected: PASS (7/7)

- [ ] **Step 5: Commit**

```bash
git add src/lib/journal tests/lib/journal
git commit -m "feat: add session-scoped journal library"
```

---

### Task 3: Pure progress calculation functions

**Files:**
- Create: `src/lib/progress/completionChart.ts`
- Create: `src/lib/progress/subjectTimeChart.ts`
- Create: `src/lib/progress/streak.ts`
- Test: `tests/lib/progress/completionChart.test.ts`
- Test: `tests/lib/progress/subjectTimeChart.test.ts`
- Test: `tests/lib/progress/streak.test.ts`

**Interfaces:**
- Consumes: nothing (pure functions, no DB, no Phase 1/2 imports).
- Produces: `computeDailyCompletion(days: DayEntries[]): CompletionPoint[]`, `computeTimeBySubject(entries: SubjectEntry[]): SubjectTimePoint[]`, `computeStreak(days: DayEntries[]): number` from their respective files, used by Task 4's `progressService.ts`.

- [ ] **Step 1: Write failing tests for `computeDailyCompletion`**

`tests/lib/progress/completionChart.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { computeDailyCompletion } from "@/lib/progress/completionChart";

describe("computeDailyCompletion", () => {
  it("excludes a day with zero plan entries entirely", () => {
    const result = computeDailyCompletion([
      { date: new Date("2026-10-15"), entries: [] },
      { date: new Date("2026-10-16"), entries: [{ checkInStatus: "done" }] },
    ]);
    expect(result).toEqual([{ date: new Date("2026-10-16"), percentDone: 100 }]);
  });

  it("computes the percentage of done entries out of all entries that day", () => {
    const result = computeDailyCompletion([
      {
        date: new Date("2026-10-16"),
        entries: [{ checkInStatus: "done" }, { checkInStatus: "done" }, { checkInStatus: "pending" }, { checkInStatus: "not_done" }],
      },
    ]);
    expect(result).toEqual([{ date: new Date("2026-10-16"), percentDone: 50 }]);
  });

  it("returns 0% for a day whose entries are all still pending, not excluded", () => {
    const result = computeDailyCompletion([
      { date: new Date("2026-10-16"), entries: [{ checkInStatus: "pending" }] },
    ]);
    expect(result).toEqual([{ date: new Date("2026-10-16"), percentDone: 0 }]);
  });

  it("returns an empty array for an empty window", () => {
    expect(computeDailyCompletion([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run and verify failure, then implement**

Run: `npx vitest run tests/lib/progress/completionChart.test.ts` — expect FAIL (module not found).

`src/lib/progress/completionChart.ts`:
```typescript
export interface DayEntries {
  date: Date;
  entries: { checkInStatus: string }[];
}

export interface CompletionPoint {
  date: Date;
  percentDone: number;
}

export function computeDailyCompletion(days: DayEntries[]): CompletionPoint[] {
  return days
    .filter((day) => day.entries.length > 0)
    .map((day) => {
      const doneCount = day.entries.filter((e) => e.checkInStatus === "done").length;
      return { date: day.date, percentDone: Math.round((doneCount / day.entries.length) * 100) };
    });
}
```

Run again, expect PASS (4/4).

- [ ] **Step 3: Write failing tests for `computeTimeBySubject`**

`tests/lib/progress/subjectTimeChart.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { computeTimeBySubject } from "@/lib/progress/subjectTimeChart";

describe("computeTimeBySubject", () => {
  it("excludes entries with a null subjectId", () => {
    const result = computeTimeBySubject(
      [{ subjectId: null, subjectName: null, estimatedMinutes: 30, checkInStatus: "done" }],
      );
    expect(result).toEqual([]);
  });

  it("sums planned minutes across every status and actual minutes across done-only", () => {
    const result = computeTimeBySubject([
      { subjectId: "s1", subjectName: "Math", estimatedMinutes: 30, checkInStatus: "done" },
      { subjectId: "s1", subjectName: "Math", estimatedMinutes: 20, checkInStatus: "partial" },
      { subjectId: "s1", subjectName: "Math", estimatedMinutes: 10, checkInStatus: "not_done" },
    ]);
    expect(result).toEqual([{ subjectId: "s1", subjectName: "Math", plannedMinutes: 60, actualMinutes: 30 }]);
  });

  it("shows nonzero planned and zero actual for a subject with no done entries", () => {
    const result = computeTimeBySubject([
      { subjectId: "s2", subjectName: "History", estimatedMinutes: 45, checkInStatus: "partial" },
    ]);
    expect(result).toEqual([{ subjectId: "s2", subjectName: "History", plannedMinutes: 45, actualMinutes: 0 }]);
  });

  it("groups multiple subjects independently", () => {
    const result = computeTimeBySubject([
      { subjectId: "s1", subjectName: "Math", estimatedMinutes: 30, checkInStatus: "done" },
      { subjectId: "s2", subjectName: "History", estimatedMinutes: 20, checkInStatus: "done" },
    ]);
    expect(result).toHaveLength(2);
  });
});
```

- [ ] **Step 4: Run and verify failure, then implement**

`src/lib/progress/subjectTimeChart.ts`:
```typescript
export interface SubjectEntry {
  subjectId: string | null;
  subjectName: string | null;
  estimatedMinutes: number;
  checkInStatus: string;
}

export interface SubjectTimePoint {
  subjectId: string;
  subjectName: string;
  plannedMinutes: number;
  actualMinutes: number;
}

export function computeTimeBySubject(entries: SubjectEntry[]): SubjectTimePoint[] {
  const bySubject = new Map<string, SubjectTimePoint>();

  for (const entry of entries) {
    if (!entry.subjectId) continue;

    const existing = bySubject.get(entry.subjectId) ?? {
      subjectId: entry.subjectId,
      subjectName: entry.subjectName ?? "Unknown subject",
      plannedMinutes: 0,
      actualMinutes: 0,
    };

    existing.plannedMinutes += entry.estimatedMinutes;
    if (entry.checkInStatus === "done") {
      existing.actualMinutes += entry.estimatedMinutes;
    }

    bySubject.set(entry.subjectId, existing);
  }

  return Array.from(bySubject.values());
}
```

Run `npx vitest run tests/lib/progress/subjectTimeChart.test.ts`, expect PASS (4/4).

- [ ] **Step 5: Write failing tests for `computeStreak`**

`tests/lib/progress/streak.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { computeStreak } from "@/lib/progress/streak";

// Each test's `days` array is ordered from TODAY backward (index 0 = today).
describe("computeStreak", () => {
  it("returns 0 for no history at all", () => {
    expect(computeStreak([])).toBe(0);
  });

  it("skips a day with zero plan entries without breaking the streak", () => {
    const days = [
      { date: new Date("2026-10-17"), entries: [{ checkInStatus: "done" }] }, // today, fully checked in
      { date: new Date("2026-10-16"), entries: [] }, // no entries, skipped
      { date: new Date("2026-10-15"), entries: [{ checkInStatus: "done" }] },
    ];
    expect(computeStreak(days)).toBe(2);
  });

  it("counts a day as a streak day if every entry is checked in, done/partial/not_done all count", () => {
    const days = [
      { date: new Date("2026-10-17"), entries: [{ checkInStatus: "done" }, { checkInStatus: "not_done" }] },
    ];
    expect(computeStreak(days)).toBe(1);
  });

  it("excludes today without breaking the streak when today still has a pending entry", () => {
    const days = [
      { date: new Date("2026-10-17"), entries: [{ checkInStatus: "pending" }] }, // today, not fully checked in yet
      { date: new Date("2026-10-16"), entries: [{ checkInStatus: "done" }] },
      { date: new Date("2026-10-15"), entries: [{ checkInStatus: "done" }] },
    ];
    expect(computeStreak(days)).toBe(2);
  });

  it("ends the streak at the first non-today day with a pending entry", () => {
    const days = [
      { date: new Date("2026-10-17"), entries: [{ checkInStatus: "done" }] },
      { date: new Date("2026-10-16"), entries: [{ checkInStatus: "pending" }] }, // breaks here
      { date: new Date("2026-10-15"), entries: [{ checkInStatus: "done" }] }, // never reached
    ];
    expect(computeStreak(days)).toBe(1);
  });
});
```

- [ ] **Step 6: Run and verify failure, then implement**

`src/lib/progress/streak.ts`:
```typescript
import type { DayEntries } from "./completionChart";

function isFullyCheckedIn(day: DayEntries): boolean {
  return day.entries.length > 0 && day.entries.every((e) => e.checkInStatus !== "pending");
}

function hasPending(day: DayEntries): boolean {
  return day.entries.some((e) => e.checkInStatus === "pending");
}

/** `days` must be ordered from today backward (index 0 = today). */
export function computeStreak(days: DayEntries[]): number {
  let streak = 0;

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const isToday = i === 0;

    if (day.entries.length === 0) {
      continue; // skip, neither extends nor breaks
    }

    if (isFullyCheckedIn(day)) {
      streak += 1;
      continue;
    }

    if (hasPending(day)) {
      if (isToday) {
        continue; // today not yet countable, but doesn't break the streak
      }
      break; // a past day with an unchecked entry ends the streak
    }
  }

  return streak;
}
```

- [ ] **Step 7: Run and verify pass**

Run: `npx vitest run tests/lib/progress/streak.test.ts`
Expected: PASS (5/5)

- [ ] **Step 8: Run the full suite to confirm no regressions**

Run: `npx vitest run`
Expected: all tests PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/progress/completionChart.ts src/lib/progress/subjectTimeChart.ts src/lib/progress/streak.ts tests/lib/progress/completionChart.test.ts tests/lib/progress/subjectTimeChart.test.ts tests/lib/progress/streak.test.ts
git commit -m "feat: add pure progress calculation functions (completion, time-by-subject, streak)"
```

---

### Task 4: Progress service

**Files:**
- Create: `src/lib/progress/progressService.ts`
- Test: `tests/lib/progress/progressService.test.ts`

**Interfaces:**
- Consumes: `computeDailyCompletion`/`computeTimeBySubject`/`computeStreak` (Task 3), `getCurrentSessionUser` (Phase 1), `todayInTimezone` (Phase 1), `prisma` (Phase 1).
- Produces: `getProgressData(window: "week" | "month"): Promise<ProgressData>`, `getCurrentStreak(): Promise<number>` from `@/lib/progress/progressService`, used by Task 6's `/progress` page and Task 7's dashboard integration.

- [ ] **Step 1: Write failing tests**

`tests/lib/progress/progressService.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    studentProfile: { findUnique: vi.fn() },
    planEntry: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/auth/session", () => ({ getCurrentSessionUser: vi.fn() }));

import { prisma } from "@/lib/db/prisma";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { getProgressData, getCurrentStreak } from "@/lib/progress/progressService";

const sessionUser = { id: "u1", email: "s@example.test", emailVerified: new Date() };
const profile = { id: "p1", userId: "u1", timezone: "UTC" };

describe("getProgressData", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an empty, honest result with no session", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(null);
    const result = await getProgressData("week");
    expect(result.completion).toEqual([]);
    expect(result.subjectTime).toEqual([]);
    expect(result.hasActivity).toBe(false);
  });

  it("queries a 7-day window for 'week' and a 30-day window for 'month'", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.planEntry.findMany as any).mockResolvedValue([]);

    await getProgressData("week");
    const weekCall = (prisma.planEntry.findMany as any).mock.calls[0][0];
    const weekSpanMs = new Date().getTime() - weekCall.where.date.gte.getTime();
    expect(weekSpanMs).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000 + 1000);

    vi.clearAllMocks();
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.planEntry.findMany as any).mockResolvedValue([]);
    await getProgressData("month");
    const monthCall = (prisma.planEntry.findMany as any).mock.calls[0][0];
    const monthSpanMs = new Date().getTime() - monthCall.where.date.gte.getTime();
    expect(monthSpanMs).toBeGreaterThan(7 * 24 * 60 * 60 * 1000);
  });

  it("reports hasActivity false and empty arrays when the window has no plan entries", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.planEntry.findMany as any).mockResolvedValue([]);
    const result = await getProgressData("week");
    expect(result.hasActivity).toBe(false);
    expect(result.completion).toEqual([]);
    expect(result.subjectTime).toEqual([]);
  });

  it("reports hasActivity true and real aggregates when the window has plan entries", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.planEntry.findMany as any).mockResolvedValue([
      {
        date: new Date(),
        subjectId: "s1",
        subject: { name: "Math" },
        estimatedMinutes: 30,
        checkInStatus: "done",
      },
    ]);
    const result = await getProgressData("week");
    expect(result.hasActivity).toBe(true);
    expect(result.subjectTime).toEqual([{ subjectId: "s1", subjectName: "Math", plannedMinutes: 30, actualMinutes: 30 }]);
  });
});

describe("getCurrentStreak", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 0 with no session", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(null);
    expect(await getCurrentStreak()).toBe(0);
  });

  it("queries up to 365 days back, independent of the week/month window", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.planEntry.findMany as any).mockResolvedValue([]);
    await getCurrentStreak();
    const call = (prisma.planEntry.findMany as any).mock.calls[0][0];
    const spanDays = (new Date().getTime() - call.where.date.gte.getTime()) / (24 * 60 * 60 * 1000);
    expect(spanDays).toBeGreaterThan(30);
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npx vitest run tests/lib/progress/progressService.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/progress/progressService.ts`:
```typescript
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
```

- [ ] **Step 4: Run and verify pass**

Run: `npx vitest run tests/lib/progress/progressService.test.ts`
Expected: PASS (6/6)

- [ ] **Step 5: Commit**

```bash
git add src/lib/progress/progressService.ts tests/lib/progress/progressService.test.ts
git commit -m "feat: add progress service aggregating real plan data for charts and streak"
```

---

### Task 5: `/journal` page

**Files:**
- Create: `src/app/journal/page.tsx`
- Create: `src/app/journal/JournalView.tsx`
- Test: `tests/app/journal-view.test.tsx`

**Interfaces:**
- Consumes: `getCurrentSessionUser` (Phase 1), `getTodayEntry`/`listPastEntries`/`saveJournalEntry` (Task 2).

- [ ] **Step 1: Write a failing component test**

`tests/app/journal-view.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { JournalView } from "@/app/journal/JournalView";

vi.mock("@/lib/journal/journal", () => ({ saveJournalEntry: vi.fn() }));
import { saveJournalEntry } from "@/lib/journal/journal";

const pastEntries = [
  { id: "j0", date: new Date("2026-10-16"), content: "Yesterday's entry" },
];

describe("JournalView", () => {
  it("saves today's entry and shows a confirmation", async () => {
    (saveJournalEntry as any).mockResolvedValue({ success: true });
    render(<JournalView todayEntry={null} pastEntries={pastEntries} />);

    fireEvent.change(screen.getByPlaceholderText(/how was today/i), { target: { value: "Studied algebra." } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(saveJournalEntry).toHaveBeenCalledWith("Studied algebra.");
    });
  });

  it("shows an error when saving fails", async () => {
    (saveJournalEntry as any).mockResolvedValue({ success: false, error: "Journal entry cannot be empty." });
    render(<JournalView todayEntry={null} pastEntries={pastEntries} />);

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText(/journal entry cannot be empty/i)).toBeInTheDocument();
    });
  });

  it("lists past entries in reverse chronological order, read-only", () => {
    render(<JournalView todayEntry={null} pastEntries={pastEntries} />);
    expect(screen.getByText("Yesterday's entry")).toBeInTheDocument();
  });

  it("pre-fills the textarea when today's entry already exists", () => {
    render(<JournalView todayEntry={{ id: "j1", date: new Date(), content: "Already written today" }} pastEntries={[]} />);
    expect(screen.getByDisplayValue("Already written today")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npx vitest run tests/app/journal-view.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Build the client component**

`src/app/journal/JournalView.tsx`:
```tsx
"use client";

import { useState } from "react";
import { saveJournalEntry } from "@/lib/journal/journal";

interface JournalEntryView {
  id: string;
  date: Date;
  content: string;
}

export function JournalView({
  todayEntry,
  pastEntries,
}: {
  todayEntry: JournalEntryView | null;
  pastEntries: JournalEntryView[];
}) {
  const [content, setContent] = useState(todayEntry?.content ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setStatus("saving");
    setError(null);
    const result = await saveJournalEntry(content);
    if (result.success) {
      setStatus("saved");
    } else {
      setStatus("idle");
      setError(result.error ?? "Something went wrong.");
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-medium text-lavender-dark">Today</h2>
        <textarea
          placeholder="How was today? What did you study, how did it go?"
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setStatus("idle");
          }}
          rows={6}
          className="w-full rounded-lg border border-lavender px-4 py-2"
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {status === "saved" && <p className="mt-2 text-sm text-green-700">Saved.</p>}
        <button
          onClick={handleSave}
          disabled={status === "saving"}
          className="mt-3 rounded-full bg-pink px-6 py-2 font-medium text-white hover:bg-pink-dark disabled:opacity-60"
        >
          {status === "saving" ? "Saving..." : "Save"}
        </button>
      </div>

      {pastEntries.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-medium text-lavender-dark">Past entries</h2>
          {pastEntries.map((entry) => (
            <div key={entry.id} className="rounded-xl bg-blush p-4">
              <p className="mb-1 text-xs text-slate-500">{entry.date.toLocaleDateString()}</p>
              <p className="whitespace-pre-wrap text-slate-700">{entry.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run and verify pass**

Run: `npx vitest run tests/app/journal-view.test.tsx`
Expected: PASS (4/4)

- [ ] **Step 5: Build the server page**

`src/app/journal/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getTodayEntry, listPastEntries } from "@/lib/journal/journal";
import { JournalView } from "./JournalView";

export default async function JournalPage() {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/login");

  const profile = await prisma.studentProfile.findUnique({ where: { userId: user.id } });
  if (!profile) redirect("/onboarding");

  const [todayEntry, pastEntries] = await Promise.all([getTodayEntry(), listPastEntries()]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link href="/dashboard" className="mb-4 inline-block text-sm text-lavender-dark underline">
        ← Back to dashboard
      </Link>
      <h1 className="mb-8 text-2xl font-semibold text-pink-dark">Your journal</h1>
      <JournalView todayEntry={todayEntry} pastEntries={pastEntries} />
    </main>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/journal tests/app/journal-view.test.tsx
git commit -m "feat: add /journal page"
```

---

### Task 6: `/progress` page

**Files:**
- Create: `src/app/progress/page.tsx`
- Create: `src/app/progress/ProgressView.tsx`
- Create: `src/app/progress/CompletionChart.tsx`
- Create: `src/app/progress/SubjectTimeChart.tsx`
- Test: `tests/app/progress-view.test.tsx`

**Interfaces:**
- Consumes: `getCurrentSessionUser` (Phase 1), `getProgressData`/`getCurrentStreak` (Task 4).

- [ ] **Step 1: Write a failing component test**

`tests/app/progress-view.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProgressView } from "@/app/progress/ProgressView";

vi.mock("@/lib/progress/progressService", () => ({ getProgressData: vi.fn() }));
import { getProgressData } from "@/lib/progress/progressService";

const activeData = {
  completion: [{ date: new Date("2026-10-17"), percentDone: 75 }],
  subjectTime: [{ subjectId: "s1", subjectName: "Math", plannedMinutes: 60, actualMinutes: 45 }],
  hasActivity: true,
};

const emptyData = { completion: [], subjectTime: [], hasActivity: false };

describe("ProgressView", () => {
  it("shows an honest empty-state message when there is no activity", () => {
    render(<ProgressView initialWindow="week" initialData={emptyData} streak={0} />);
    expect(screen.getByText(/no study activity yet/i)).toBeInTheDocument();
  });

  it("renders the completion and subject-time charts when activity exists", () => {
    render(<ProgressView initialWindow="week" initialData={activeData} streak={3} />);
    expect(screen.getByText(/math/i)).toBeInTheDocument();
    expect(screen.getByText(/3/)).toBeInTheDocument();
  });

  it("re-fetches data when the Month toggle is clicked", async () => {
    (getProgressData as any).mockResolvedValue(activeData);
    render(<ProgressView initialWindow="week" initialData={emptyData} streak={0} />);

    fireEvent.click(screen.getByRole("button", { name: /month/i }));

    await waitFor(() => {
      expect(getProgressData).toHaveBeenCalledWith("month");
    });
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npx vitest run tests/app/progress-view.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Build the chart components**

`src/app/progress/CompletionChart.tsx`:
```tsx
interface CompletionPoint {
  date: Date;
  percentDone: number;
}

export function CompletionChart({ data }: { data: CompletionPoint[] }) {
  const barWidth = 28;
  const gap = 8;
  const chartHeight = 120;
  const width = data.length * (barWidth + gap);

  return (
    <div>
      <svg width={width} height={chartHeight + 24} role="img" aria-label="Daily study completion percentage">
        {data.map((point, i) => {
          const barHeight = (point.percentDone / 100) * chartHeight;
          const opacity = Math.max(0.15, point.percentDone / 100);
          const x = i * (barWidth + gap);
          return (
            <g key={point.date.toISOString()}>
              <rect
                x={x}
                y={chartHeight - barHeight}
                width={barWidth}
                height={barHeight}
                rx={4}
                fill="#e87ba4"
                fillOpacity={opacity}
              >
                <title>
                  {point.date.toLocaleDateString()}: {point.percentDone}% done
                </title>
              </rect>
              <text x={x + barWidth / 2} y={chartHeight + 16} textAnchor="middle" fontSize={10} fill="#52514e">
                {point.percentDone}%
              </text>
            </g>
          );
        })}
      </svg>
      <table className="sr-only">
        <caption>Daily study completion percentage</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Percent done</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.date.toISOString()}>
              <td>{point.date.toLocaleDateString()}</td>
              <td>{point.percentDone}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

`src/app/progress/SubjectTimeChart.tsx`:
```tsx
interface SubjectTimePoint {
  subjectId: string;
  subjectName: string;
  plannedMinutes: number;
  actualMinutes: number;
}

export function SubjectTimeChart({ data }: { data: SubjectTimePoint[] }) {
  const maxMinutes = Math.max(...data.map((d) => d.plannedMinutes), 1);
  const barWidth = 18;
  const gap = 6;
  const groupGap = 20;
  const chartHeight = 140;
  const groupWidth = barWidth * 2 + gap;

  return (
    <div>
      <div className="mb-2 flex gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: "#4a3aa7" }} />
          Planned
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: "#e87ba4" }} />
          Actual
        </span>
      </div>
      <svg
        width={data.length * (groupWidth + groupGap)}
        height={chartHeight + 32}
        role="img"
        aria-label="Planned versus actual study time by subject"
      >
        {data.map((point, i) => {
          const plannedHeight = (point.plannedMinutes / maxMinutes) * chartHeight;
          const actualHeight = (point.actualMinutes / maxMinutes) * chartHeight;
          const groupX = i * (groupWidth + groupGap);
          return (
            <g key={point.subjectId}>
              <rect x={groupX} y={chartHeight - plannedHeight} width={barWidth} height={plannedHeight} rx={4} fill="#4a3aa7">
                <title>
                  {point.subjectName} planned: {point.plannedMinutes} min
                </title>
              </rect>
              <rect
                x={groupX + barWidth + gap}
                y={chartHeight - actualHeight}
                width={barWidth}
                height={actualHeight}
                rx={4}
                fill="#e87ba4"
              >
                <title>
                  {point.subjectName} actual: {point.actualMinutes} min
                </title>
              </rect>
              <text x={groupX + groupWidth / 2} y={chartHeight + 16} textAnchor="middle" fontSize={10} fill="#52514e">
                {point.subjectName}
              </text>
            </g>
          );
        })}
      </svg>
      <table className="sr-only">
        <caption>Planned versus actual study time by subject, in minutes</caption>
        <thead>
          <tr>
            <th>Subject</th>
            <th>Planned minutes</th>
            <th>Actual minutes</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.subjectId}>
              <td>{point.subjectName}</td>
              <td>{point.plannedMinutes}</td>
              <td>{point.actualMinutes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Build the client view with the Week/Month toggle**

`src/app/progress/ProgressView.tsx`:
```tsx
"use client";

import { useState } from "react";
import { getProgressData, type ProgressData } from "@/lib/progress/progressService";
import { CompletionChart } from "./CompletionChart";
import { SubjectTimeChart } from "./SubjectTimeChart";

export function ProgressView({
  initialWindow,
  initialData,
  streak,
}: {
  initialWindow: "week" | "month";
  initialData: ProgressData;
  streak: number;
}) {
  const [windowSize, setWindowSize] = useState(initialWindow);
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);

  async function handleToggle(next: "week" | "month") {
    setWindowSize(next);
    setLoading(true);
    const result = await getProgressData(next);
    setData(result);
    setLoading(false);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Check-in streak</p>
        <p className="text-3xl font-semibold text-pink-dark">{streak}</p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => handleToggle("week")}
          className={`rounded-full px-4 py-1 text-sm ${windowSize === "week" ? "bg-pink text-white" : "border border-lavender text-lavender-dark"}`}
        >
          Week
        </button>
        <button
          onClick={() => handleToggle("month")}
          className={`rounded-full px-4 py-1 text-sm ${windowSize === "month" ? "bg-pink text-white" : "border border-lavender text-lavender-dark"}`}
        >
          Month
        </button>
      </div>

      {loading ? (
        <p className="text-slate-500">Loading...</p>
      ) : !data.hasActivity ? (
        <p className="rounded-xl bg-blush p-4 text-sm text-slate-700">No study activity yet in this period.</p>
      ) : (
        <>
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-medium text-lavender-dark">Daily completion</h2>
            <CompletionChart data={data.completion} />
          </div>
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-medium text-lavender-dark">Time by subject</h2>
            <SubjectTimeChart data={data.subjectTime} />
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run and verify pass**

Run: `npx vitest run tests/app/progress-view.test.tsx`
Expected: PASS (3/3)

- [ ] **Step 6: Build the server page**

`src/app/progress/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getProgressData, getCurrentStreak } from "@/lib/progress/progressService";
import { ProgressView } from "./ProgressView";

export default async function ProgressPage() {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/login");

  const profile = await prisma.studentProfile.findUnique({ where: { userId: user.id } });
  if (!profile) redirect("/onboarding");

  const [data, streak] = await Promise.all([getProgressData("week"), getCurrentStreak()]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link href="/dashboard" className="mb-4 inline-block text-sm text-lavender-dark underline">
        ← Back to dashboard
      </Link>
      <h1 className="mb-8 text-2xl font-semibold text-pink-dark">Your progress</h1>
      <ProgressView initialWindow="week" initialData={data} streak={streak} />
    </main>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add src/app/progress tests/app/progress-view.test.tsx
git commit -m "feat: add /progress page with completion, time-by-subject, and streak"
```

---

### Task 7: Dashboard integration

**Files:**
- Modify: `src/app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `getCurrentStreak` (Task 4).

- [ ] **Step 1: Replace the "Progress reports" placeholder with a real summary**

In `src/app/dashboard/page.tsx`, find the remaining placeholder section (after Phase 2's Task 7 replaced two of the original four, "Progress reports" is the one still rendered as `<section className="mb-4 rounded-xl border border-dashed border-lavender p-6 text-slate-500">Progress reports is coming in a later phase.</section>`). Replace it with:

```tsx
      <section className="mb-4 rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-medium text-lavender-dark">Progress</h2>
        <p className="text-slate-600">
          {streak > 0 ? `${streak}-day check-in streak.` : "No check-in streak yet — visit your plan to get started."}
        </p>
        <Link href="/progress" className="mt-2 inline-block text-sm text-lavender-dark underline">
          View your progress
        </Link>
      </section>
```

Add the import and the data fetch, alongside the existing `listTasks`/`getOrGeneratePlanForDate` calls from Phase 2:
```tsx
import { getCurrentStreak } from "@/lib/progress/progressService";
// ...
const streak = await getCurrentStreak();
```

- [ ] **Step 2: Run the full suite and confirm nothing broke**

Run: `npx vitest run`
Expected: all tests PASS.

- [ ] **Step 3: Run `tsc` to confirm the edit type-checks**

Run: `npx tsc --noEmit`
Expected: clean, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: replace dashboard progress-reports placeholder with real streak summary"
```

---

### Task 8: Final integration pass

**Files:**
- None created — verification only.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 2: Run a production build**

Run: `npm run build`
Expected: builds without type errors; `/journal` and `/progress` appear in the route list as dynamic (`ƒ`) routes.

- [ ] **Step 3: Visual/accessibility sanity check**

With `npm run dev` running, open `/progress` for a test account with some Phase 2 activity (open tasks, a few checked-in plan entries across more than one subject) and confirm: both charts render with visible bars, every bar has a visible numeric label, the subject-time chart shows a legend distinguishing Planned/Actual, the Week/Month toggle changes the displayed data, and a brand-new account with zero activity shows the "No study activity yet" message instead of empty/broken charts.

- [ ] **Step 4: Commit (only if the sanity check required fixes)**

```bash
git add -A
git commit -m "fix: address issues found in Phase 3 final integration pass"
```

(Skip this step entirely if nothing needed fixing.)
