# Phase 5 — Streaks/Achievements, Notification Preferences, Scheduled Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add longest-streak/achievements, a weekly/monthly activity calendar, a real editable notification-preferences UI, and Vercel-Cron-scheduled daily reminders wired to the existing email system.

**Architecture:** Two additive Prisma migrations (new `ReminderPreference` columns, new `ReminderLog` table). A pure-function layer (`computeLongestStreak`, `computeAchievements`) with zero DB dependency. A `"use server"` preferences module following the session's established ownership-check pattern. A cron-authenticated (not session-authenticated) API route reusing the existing `sendEmail`/task/plan functions. UI additions to the existing `/progress` and `/profile` pages plus a new dashboard card — no new top-level nav item.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma/Postgres, Vitest + RTL, Vercel Cron — identical to Phases 1-4, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-24-phase5-streaks-notifications-design.md`

## Global Constraints

- Every new table/column is scoped to `studentProfileId`; every server action resolves the acting student from `getCurrentSessionUser()` → `StudentProfile` internally (see `getOwnProfile()` in every prior phase's data module) — except the cron route, which has no user session and is authorized by `CRON_SECRET` instead.
- `ReminderLog` has `@@unique([studentProfileId, date, channel])` — this is the idempotency mechanism, enforced by the database, not just application logic.
- The cron route must never claim a message was delivered unless `sendEmail`'s own return value says so — honest non-delivery (`delivered: false`) when `RESEND_API_KEY`/WhatsApp credentials are absent, exactly like every existing email path.
- `totalActiveDays` and achievement unlocking both reuse the *existing* "every `PlanEntry` for that day is non-pending" streak-day definition (Phase 3) — no new, looser definition of "active day."
- WhatsApp: consent (`whatsappConsentGivenAt`) is required before `channel` can be set to `"whatsapp"`; no WhatsApp message is ever sent by this phase's code — the cron job logs an honest skip for that channel.
- Dates: `ReminderLog.date` is UTC-midnight-anchored like `PlanEntry.date`/`JournalEntry.date` — use `todayInTimezone(profile.timezone)`, never a bare `new Date()`. `ReminderPreference`'s new `quietHoursStart`/`quietHoursEnd` are plain `"HH:mm"` strings (matching `TimetableEntry`'s existing convention), not `DateTime`.
- Pastel-replaced design system tokens (`brand`, `ink`, `ink-muted`, `surface-page`, `border`, `success`, `warning`, `danger`) from `tailwind.config.ts` — no new colors.

## Review Focus

- **A student whose `preferredTimes` contains an hour, but who is currently inside their own `quietHoursStart`–`quietHoursEnd` window**, must not receive a reminder that hour — the cron selection query must apply both filters together, not just the time match. (Task 7.)
- **Two near-simultaneous cron invocations for the same student+date+channel** (a retried Vercel Cron call, or an overlapping manual trigger) must send at most one reminder — proven under real concurrency the same way `rateLimit.test.ts` proved it this session, not just asserted against a mock. (Task 7.)
- **A student with a longest streak in the past but a current streak of 0** must still see their longest-streak achievements as unlocked, and the dashboard copy must not read as a shaming message. (Task 2, Task 8.)
- **Setting `channel` to `"whatsapp"` without checking the consent box** must be rejected server-side, not just hidden client-side — the preferences module is the enforcement point, since a direct server-action call bypasses any client-only check. (Task 5.)
- **A window with real `PlanEntry` activity but zero days reaching 100% (or zero days at all)** must render the activity calendar's empty cells honestly (no `PlanEntry` rows that day) distinctly from 0%-complete cells (rows exist, none done) — reusing `computeDailyCompletion`'s existing exclusion rule, not a new one that conflates the two. (Task 4.)

---

### Task 1: ReminderPreference columns + ReminderLog schema

**Files:**
- Modify: `prisma/schema.prisma`
- Test: `tests/lib/db/reminderLogSchema.test.ts`

**Interfaces:**
- Produces: `ReminderPreference.quietHoursStart: String?`, `ReminderPreference.quietHoursEnd: String?`, `ReminderPreference.whatsappConsentGivenAt: DateTime?`; the `ReminderLog` model and its generated Prisma types, used by Task 7.

- [ ] **Step 1: Add the three columns to `ReminderPreference` and the new `ReminderLog` model**

```prisma
model ReminderPreference {
  id                     String    @id @default(cuid())
  studentProfileId       String    @unique
  channel                String // "none" | "email" | "whatsapp"
  preferredTimes         String // JSON-encoded string[] of "HH:mm"
  phone                  String?
  quietHoursStart        String? // "HH:mm"
  quietHoursEnd          String? // "HH:mm"
  whatsappConsentGivenAt DateTime?

  studentProfile StudentProfile @relation(fields: [studentProfileId], references: [id], onDelete: Cascade)
}

model ReminderLog {
  id               String   @id @default(cuid())
  studentProfileId String
  date             DateTime // UTC-midnight-anchored calendar date
  channel          String // "email" | "whatsapp"
  delivered        Boolean
  createdAt        DateTime @default(now())

  studentProfile StudentProfile @relation(fields: [studentProfileId], references: [id], onDelete: Cascade)

  @@unique([studentProfileId, date, channel])
}
```

Add `reminderLogs ReminderLog[]` to `StudentProfile`'s relations block (alongside the existing `reminderPreference`).

- [ ] **Step 2: Run the migration**

Run: `npx prisma migrate dev --name add_reminder_log_and_quiet_hours`
Expected: migration applies cleanly against the local Postgres database (additive only — no existing column or table is altered or dropped).

- [ ] **Step 3: Write the failing schema integration test**

```typescript
// tests/lib/db/reminderLogSchema.test.ts
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db/prisma";

describe("ReminderLog schema", () => {
  it("enforces one log row per student, date, and channel", async () => {
    const user = await prisma.user.create({
      data: { email: `reminder-${Date.now()}@example.test`, passwordHash: "x", emailVerified: new Date() },
    });
    const profile = await prisma.studentProfile.create({
      data: {
        userId: user.id, name: "Test Student", dateOfBirth: new Date("2010-01-01"),
        grade: "8", schoolName: "Test School", curriculum: "General", academicYear: "2026",
        timezone: "UTC",
      },
    });
    const date = new Date("2026-10-24T00:00:00.000Z");

    await prisma.reminderLog.create({
      data: { studentProfileId: profile.id, date, channel: "email", delivered: true },
    });

    await expect(
      prisma.reminderLog.create({
        data: { studentProfileId: profile.id, date, channel: "email", delivered: false },
      }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 4: Run test to verify it fails, then passes**

Run: `npx vitest run tests/lib/db/reminderLogSchema.test.ts`
Expected: FAIL before Step 1-2 (no `reminderLog` on the Prisma client), PASS after.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations tests/lib/db/reminderLogSchema.test.ts
git commit -m "feat: add ReminderLog and quiet-hours/consent columns"
```

---

### Task 2: Pure streak/achievement functions

**Files:**
- Modify: `src/lib/progress/streak.ts`
- Create: `src/lib/progress/achievements.ts`
- Test: `tests/lib/progress/streak.test.ts` (extend)
- Test: `tests/lib/progress/achievements.test.ts`

**Interfaces:**
- Consumes: the existing `DayEntries` type already exported from `src/lib/progress/completionChart.ts` (do not redefine it).
- Produces (consumed by Task 3):
  ```typescript
  // streak.ts (new export alongside the existing computeStreak)
  export function computeLongestStreak(days: DayEntries[]): number

  // achievements.ts
  export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100] as const;
  export interface Achievement {
    days: number;
    unlocked: boolean;
  }
  export function computeAchievements(longestStreakEver: number): Achievement[]
  ```

- [ ] **Step 1: Write the failing tests**

```typescript
// appended to tests/lib/progress/streak.test.ts
import { computeLongestStreak } from "@/lib/progress/streak";

describe("computeLongestStreak", () => {
  it("finds the longest run even when it isn't the current (most recent) one", () => {
    // today-first order: today is a broken day (pending), but days 3-5 back were a 3-day run
    const days = [
      { date: new Date("2026-10-24"), entries: [{ checkInStatus: "pending" }] },
      { date: new Date("2026-10-23"), entries: [{ checkInStatus: "done" }] },
      { date: new Date("2026-10-22"), entries: [{ checkInStatus: "done" }] },
      { date: new Date("2026-10-21"), entries: [{ checkInStatus: "done" }] },
      { date: new Date("2026-10-20"), entries: [{ checkInStatus: "pending" }] },
    ];
    expect(computeLongestStreak(days)).toBe(3);
  });

  it("returns 0 for an empty history", () => {
    expect(computeLongestStreak([])).toBe(0);
  });

  it("skips zero-entry days without breaking a run, same as computeStreak", () => {
    const days = [
      { date: new Date("2026-10-24"), entries: [{ checkInStatus: "done" }] },
      { date: new Date("2026-10-23"), entries: [] },
      { date: new Date("2026-10-22"), entries: [{ checkInStatus: "done" }] },
    ];
    expect(computeLongestStreak(days)).toBe(2);
  });
});
```

```typescript
// tests/lib/progress/achievements.test.ts
import { describe, it, expect } from "vitest";
import { computeAchievements, STREAK_MILESTONES } from "@/lib/progress/achievements";

describe("computeAchievements", () => {
  it("unlocks every milestone at or below the longest streak ever reached", () => {
    const result = computeAchievements(14);
    expect(result.find((a) => a.days === 14)?.unlocked).toBe(true);
    expect(result.find((a) => a.days === 7)?.unlocked).toBe(true);
    expect(result.find((a) => a.days === 30)?.unlocked).toBe(false);
  });

  it("returns one entry per milestone, locked, for a streak of 0", () => {
    const result = computeAchievements(0);
    expect(result).toHaveLength(STREAK_MILESTONES.length);
    expect(result.every((a) => !a.unlocked)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/progress/streak.test.ts tests/lib/progress/achievements.test.ts`
Expected: FAIL — `computeLongestStreak`/module not found.

- [ ] **Step 3: Implement `computeLongestStreak` and `achievements.ts`**

`computeLongestStreak`: walk `days` in the given (today-first) order exactly like `computeStreak` does for determining whether a day counts (zero-entry → skip, don't break or extend; fully-non-pending → counts), but track a running `currentRun` and `longest = Math.max(longest, currentRun)`, resetting `currentRun` to 0 on any day with a pending entry (no today-exception here — this function reports historical bests, not "is my streak alive right now," so every day is judged the same way). `computeAchievements`: `STREAK_MILESTONES.map(days => ({ days, unlocked: longestStreakEver >= days }))`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/progress/streak.test.ts tests/lib/progress/achievements.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/progress/streak.ts src/lib/progress/achievements.ts tests/lib/progress/streak.test.ts tests/lib/progress/achievements.test.ts
git commit -m "feat: add longest-streak and achievement-threshold pure functions"
```

---

### Task 3: Streak-stats service

**Files:**
- Modify: `src/lib/progress/progressService.ts`
- Test: `tests/lib/progress/progressService.test.ts` (extend)

**Interfaces:**
- Consumes: `computeLongestStreak` from `./streak` (Task 2); the existing `groupByDate`, `getOwnProfile`, 365-day-lookback `PlanEntry` query already in this file for `getCurrentStreak`.
- Produces (consumed by Task 8):
  ```typescript
  export interface StreakStats {
    current: number;
    longest: number;
    totalActiveDays: number;
  }
  export async function getStreakStats(): Promise<StreakStats>
  ```
  `getCurrentStreak()` (existing, unchanged signature) stays exported as-is for the existing dashboard/`/progress` callers — do not remove it; `getStreakStats` is additive.

- [ ] **Step 1: Write the failing test**

```typescript
// appended to tests/lib/progress/progressService.test.ts
describe("getStreakStats", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns zeroed stats with no session", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(null);
    expect(await getStreakStats()).toEqual({ current: 0, longest: 0, totalActiveDays: 0 });
  });

  it("computes current, longest, and totalActiveDays from one 365-day query", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    const today = todayInTimezone(profile.timezone);
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    (prisma.planEntry.findMany as any).mockResolvedValue([
      { date: today, subjectId: "s1", subject: { name: "Math" }, estimatedMinutes: 30, checkInStatus: "done" },
      { date: yesterday, subjectId: "s1", subject: { name: "Math" }, estimatedMinutes: 30, checkInStatus: "done" },
    ]);
    const stats = await getStreakStats();
    expect(stats.current).toBe(2);
    expect(stats.longest).toBe(2);
    expect(stats.totalActiveDays).toBe(2);
    expect(prisma.planEntry.findMany).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/progress/progressService.test.ts`
Expected: FAIL — `getStreakStats` not exported.

- [ ] **Step 3: Implement `getStreakStats` in `progressService.ts`**

Reuse the exact same profile-resolution and `prisma.planEntry.findMany({where:{studentProfileId, date:{gte: lookbackStart}}})` query `getCurrentStreak` already makes (365-day lookback) — call it once, build `byDate` via the existing `groupByDate` + today-seeding logic already in `getCurrentStreak`, then derive all three numbers from that single `byDate` array: `current = computeStreak(byDate)`, `longest = computeLongestStreak(byDate)`, `totalActiveDays` = count of entries in `byDate` where every entry is non-pending (same predicate `computeStreak`/`computeLongestStreak` use internally for "counts as a streak day" — do not write a fourth, slightly-different definition here).

- [ ] **Step 4: Run test to verify it passes, then the full suite**

Run: `npx vitest run tests/lib/progress/progressService.test.ts`
Expected: PASS

Run: `npx vitest run`
Expected: all existing tests still pass (confirms `getCurrentStreak`'s existing behavior/callers are untouched).

- [ ] **Step 5: Commit**

```bash
git add src/lib/progress/progressService.ts tests/lib/progress/progressService.test.ts
git commit -m "feat: add getStreakStats (current/longest/totalActiveDays from one query)"
```

---

### Task 4: Weekly/monthly activity calendar

**Files:**
- Create: `src/app/(app)/progress/ActivityCalendar.tsx`
- Modify: `src/app/(app)/progress/ProgressView.tsx`
- Test: `tests/app/activity-calendar.test.tsx`

**Interfaces:**
- Consumes: `CompletionPoint` type (already exported from `src/lib/progress/completionChart.ts`); `ProgressView`'s existing `data.completion` prop (already `CompletionPoint[]`, no new data plumbing needed).

- [ ] **Step 1: Write the failing RTL test**

```typescript
// tests/app/activity-calendar.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActivityCalendar } from "@/app/(app)/progress/ActivityCalendar";

describe("ActivityCalendar", () => {
  it("renders a filled cell for a day with activity and an empty cell for a day with none", () => {
    const data = [
      { date: new Date("2026-10-23"), percentDone: 100 },
      { date: new Date("2026-10-24"), percentDone: 0 },
    ];
    const { container } = render(<ActivityCalendar data={data} />);
    const filled = container.querySelector('[data-testid="activity-cell-2026-10-23"]');
    const emptyDay = container.querySelector('[data-testid="activity-cell-2026-10-22"]');
    expect(filled?.getAttribute("data-has-activity")).toBe("true");
    expect(emptyDay).toBeNull();
  });

  it("shows an honest message instead of an empty grid when there is no activity at all", () => {
    render(<ActivityCalendar data={[]} />);
    expect(screen.getByText(/no activity yet/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/app/activity-calendar.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `ActivityCalendar.tsx`**

`"use client"` (or a plain function component, no state needed — server-renderable). Props: `{ data: CompletionPoint[] }`. If `data.length === 0`, render `<p className="text-sm text-ink-muted">No activity yet in this period.</p>`. Otherwise render a 7-column CSS grid, one `<div>` per entry in `data` (not one per calendar slot — only days that actually have a `CompletionPoint`, i.e. only days with real `PlanEntry` rows, get a cell; this is the honest-empty-day rule from the spec), `data-testid={`activity-cell-${formatted-date}`}` (use `date.toISOString().slice(0,10)`), `data-has-activity="true"`, background `#e87ba4` at `fillOpacity`-equivalent CSS `opacity: Math.max(0.15, percentDone/100)` (same scaling `CompletionChart` already uses), a `title` attribute with the date and percent for hover detail.

Wire into `ProgressView.tsx`: inside the existing `data.completion.length > 0 ? (...) : (...)` branch (the one Task 8 of the Phase 3 plan already added for the empty-subject-time case — do not duplicate that gating, add `<ActivityCalendar data={data.completion} />` as a new card alongside the existing `CompletionChart`/`SubjectTimeChart` cards, same `rounded-xl bg-white p-6 shadow-sm` wrapper, heading "Activity calendar").

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/app/activity-calendar.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/progress/ActivityCalendar.tsx src/app/\(app\)/progress/ProgressView.tsx tests/app/activity-calendar.test.tsx
git commit -m "feat: add weekly/monthly activity calendar to /progress"
```

---

### Task 5: Notification preferences library

**Files:**
- Create: `src/lib/notifications/preferences.ts`
- Test: `tests/lib/notifications/preferences.test.ts`

**Interfaces:**
- Produces (consumed by Task 6):
  ```typescript
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
  export async function getPreferences(): Promise<PreferencesView | null>
  export async function updatePreferences(input: PreferencesInput): Promise<{ success: boolean; error?: string }>
  ```

- [ ] **Step 1: Write the failing tests**

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/notifications/preferences.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/notifications/preferences.ts`**

`getOwnProfile()` identical in shape to every prior module. `getPreferences`: `prisma.reminderPreference.findUnique({where:{studentProfileId: profile.id}})`, return `null` if no row exists yet (a student who never touched notification settings), else map `preferredTimes` via `JSON.parse`, `whatsappConsentGiven: !!row.whatsappConsentGivenAt`. `updatePreferences`: validate `channel === "whatsapp"` requires BOTH `whatsappConsentGiven === true` AND `phone` matching `/^\+\d{8,15}$/` — return `{success:false, error:"..."}` on either failure without touching the database; otherwise `prisma.reminderPreference.upsert({where:{studentProfileId: profile.id}, create:{...}, update:{...}})` with `whatsappConsentGivenAt: input.channel === "whatsapp" && input.whatsappConsentGiven ? new Date() : null` in both branches, `preferredTimes: JSON.stringify(input.preferredTimes)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/notifications/preferences.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications/preferences.ts tests/lib/notifications/preferences.test.ts
git commit -m "feat: add notification preferences library with consent/phone validation"
```

---

### Task 6: Notification preferences settings UI

**Files:**
- Modify: `src/app/(app)/profile/page.tsx`
- Create: `src/app/(app)/profile/NotificationPreferencesForm.tsx`
- Test: `tests/app/notification-preferences-form.test.tsx`

**Interfaces:**
- Consumes: `getPreferences`, `updatePreferences`, `type PreferencesView` from `@/lib/notifications/preferences` (Task 5).

- [ ] **Step 1: Write the failing RTL test**

```typescript
// tests/app/notification-preferences-form.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NotificationPreferencesForm } from "@/app/(app)/profile/NotificationPreferencesForm";

vi.mock("@/lib/notifications/preferences", () => ({ updatePreferences: vi.fn() }));
import { updatePreferences } from "@/lib/notifications/preferences";

const initial = {
  channel: "none" as const, preferredTimes: [], phone: null,
  quietHoursStart: null, quietHoursEnd: null, whatsappConsentGiven: false,
};

describe("NotificationPreferencesForm", () => {
  it("only shows the phone field and consent checkbox when whatsapp is selected", () => {
    render(<NotificationPreferencesForm initial={initial} />);
    expect(screen.queryByLabelText(/phone/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/whatsapp/i));
    expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
    expect(screen.getByText(/By enabling WhatsApp reminders/i)).toBeInTheDocument();
  });

  it("shows a validation error and does not save when whatsapp is chosen without checking consent", async () => {
    (updatePreferences as any).mockResolvedValue({ success: false, error: "WhatsApp requires your consent." });
    render(<NotificationPreferencesForm initial={initial} />);
    fireEvent.click(screen.getByLabelText(/whatsapp/i));
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: "+15551234567" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => {
      expect(screen.getByText(/requires your consent/i)).toBeInTheDocument();
    });
  });

  it("saves successfully and shows a confirmation", async () => {
    (updatePreferences as any).mockResolvedValue({ success: true });
    render(<NotificationPreferencesForm initial={initial} />);
    fireEvent.click(screen.getByLabelText(/email/i));
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => {
      expect(screen.getByText(/saved/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/app/notification-preferences-form.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `NotificationPreferencesForm.tsx` and wire it into `profile/page.tsx`**

`"use client"`, props `{ initial: PreferencesView }`. Radio group for `channel` (`none`/`email`/`whatsapp`, labeled exactly "None"/"Email"/"WhatsApp" so the test's `getByLabelText(/whatsapp/i)` matches), a preferred-time input (reuse a simple `<input type="time">` for one time — the spec's `preferredTimes` is an array but a single-value time picker covers this phase's UI scope; store it as `[value]`), quiet-hours start/end (`<input type="time">`, optional), and — only rendered when `channel === "whatsapp"` — a phone `<input>` labeled "Phone" and a consent `<label>` checkbox with the exact consent text from the spec. On submit, call `updatePreferences`, show `result.error` or a "Saved." confirmation, following the same status-state pattern as `ProfileEditForm`/`JournalView`.

In `profile/page.tsx`: call `getPreferences()` alongside the existing profile query, pass the result (or a sensible all-`none`/empty default when `null`) into a new `<NotificationPreferencesForm initial={...} />` rendered below the existing `<ProfileEditForm>`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/app/notification-preferences-form.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/profile/NotificationPreferencesForm.tsx" "src/app/(app)/profile/page.tsx" tests/app/notification-preferences-form.test.tsx
git commit -m "feat: add notification preferences settings UI to /profile"
```

---

### Task 7: Cron-scheduled daily reminders

**Files:**
- Create: `src/app/api/cron/daily-reminders/route.ts`
- Modify: `vercel.json`
- Test: `tests/app/api/cron-daily-reminders.test.ts`

**Interfaces:**
- Consumes: `sendEmail` from `@/lib/email/send`; `listTasks` from `@/lib/tasks/tasks` (note: `listTasks` is itself session-scoped via `getCurrentSessionUser()` — the cron route has no session, so it must query `prisma.task`/`prisma.planEntry` directly for each candidate student, not call `listTasks()`); `todayInTimezone` from `@/lib/validation/age`.
- Produces: nothing further consumes this route; it is a terminal HTTP endpoint.

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/app/api/cron-daily-reminders.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    studentProfile: { findMany: vi.fn() },
    task: { count: vi.fn() },
    reminderLog: { findUnique: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn() }));

import { prisma } from "@/lib/db/prisma";
import { sendEmail } from "@/lib/email/send";
import { GET } from "@/app/api/cron/daily-reminders/route";

function req(secret?: string) {
  return new Request("http://localhost/api/cron/daily-reminders", {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

describe("GET /api/cron/daily-reminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
    (prisma.$transaction as any).mockImplementation((cb: any) => cb(prisma));
  });

  it("rejects a request with a missing or wrong CRON_SECRET without touching the database", async () => {
    const res = await GET(req("wrong-secret"));
    expect(res.status).toBe(401);
    expect(prisma.studentProfile.findMany).not.toHaveBeenCalled();
  });

  it("skips a student inside their own quiet hours even if the preferred time matches", async () => {
    (prisma.studentProfile.findMany as any).mockResolvedValue([
      {
        id: "p1", timezone: "UTC",
        reminderPreference: {
          channel: "email", preferredTimes: JSON.stringify(["12:00"]),
          quietHoursStart: "11:00", quietHoursEnd: "13:00",
        },
      },
    ]);
    await GET(req("test-secret"));
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends at most one reminder per student/date/channel across two invocations (idempotency)", async () => {
    (prisma.studentProfile.findMany as any).mockResolvedValue([
      {
        id: "p1", timezone: "UTC",
        reminderPreference: { channel: "email", preferredTimes: JSON.stringify(["00:00"]), quietHoursStart: null, quietHoursEnd: null },
      },
    ]);
    (prisma.reminderLog.findUnique as any)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "log1" });
    (prisma.task.count as any).mockResolvedValue(2);
    (sendEmail as any).mockResolvedValue({ delivered: false, reason: "no_provider" });

    await GET(req("test-secret"));
    await GET(req("test-secret"));

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(prisma.reminderLog.create).toHaveBeenCalledTimes(1);
  });
});
```

(The implementer should adjust the `$transaction` mock to match `tests/lib/plan/planService.test.ts`'s established convention, as in every prior task this session that mocks `$transaction`.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/app/api/cron-daily-reminders.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the route and `vercel.json`**

`route.ts`: `export async function GET(request: Request)`. First line: compare `request.headers.get("authorization")` to `` `Bearer ${process.env.CRON_SECRET}` `` — mismatch or missing → `new Response(null, { status: 401 })`, return immediately. Then `prisma.studentProfile.findMany({where: {reminderPreference: {channel: {not: "none"}}}, include: {reminderPreference: true}})`. For each profile: compute `todayInTimezone(profile.timezone)` and the current `"HH:mm"` in that timezone (reuse the same `Intl.DateTimeFormat` approach `todayInTimezone` already uses, formatting `hour`/`minute` instead of the date — if this needs a new small helper, add `currentTimeInTimezone(timezone: string): string` to `src/lib/validation/age.ts` alongside `todayInTimezone`, same file, same pattern); skip if that `"HH:mm"` isn't in the decoded `preferredTimes`, or if it falls within `quietHoursStart`–`quietHoursEnd` (string comparison is sufficient for same-day quiet windows; an overnight window like `21:00`–`07:00` needs the "before end OR after start" OR-case, not a simple range check — write this condition carefully and cover it with a test). For a profile that passes both filters, run inside `prisma.$transaction(async (tx) => {...})`: a Postgres advisory lock (`SELECT pg_advisory_xact_lock(hashtext(...))`, same pattern as `checkRateLimit` in `src/lib/security/rateLimit.ts`) keyed on `` `reminder:${profile.id}:${dateKey}:${channel}` ``, then `tx.reminderLog.findUnique({where:{studentProfileId_date_channel: {...}}})` — if found, skip; otherwise count open tasks (`tx.task.count({where:{studentProfileId: profile.id, status:"open"}})`), call `sendEmail(...)` for `channel === "email"` (or log an honest `{delivered:false}` skip for `"whatsapp"` without calling anything, since no provider exists), and `tx.reminderLog.create({data:{studentProfileId: profile.id, date: today, channel, delivered}})`. Return `Response.json({processed: N})` at the end.

`vercel.json`:
```json
{
  "framework": "nextjs",
  "crons": [{ "path": "/api/cron/daily-reminders", "schedule": "0 * * * *" }]
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/app/api/cron-daily-reminders.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/cron/daily-reminders/route.ts" vercel.json tests/app/api/cron-daily-reminders.test.ts src/lib/validation/age.ts tests/lib/validation/age.test.ts
git commit -m "feat: add cron-scheduled daily reminders with quiet hours and idempotency"
```

---

### Task 8: Dashboard integration

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `getStreakStats` from `@/lib/progress/progressService` (Task 3, replaces the existing bare `getCurrentStreak()` call on the dashboard — `getCurrentStreak` stays available for `/progress`'s existing use, this page switches to the richer stats call); `computeAchievements`, `STREAK_MILESTONES` from `@/lib/progress/achievements` (Task 2).

- [ ] **Step 1: Write the failing test**

```typescript
// tests/lib/progress/dashboardStreakCard.test.ts
import { describe, it, expect } from "vitest";
import { summarizeStreakCard } from "@/lib/progress/dashboardStreakCard";

describe("summarizeStreakCard", () => {
  it("gives encouraging copy for a zero current streak with a positive longest streak", () => {
    const text = summarizeStreakCard({ current: 0, longest: 5, totalActiveDays: 12 });
    expect(text).toMatch(/best streak: 5/i);
    expect(text).not.toMatch(/broken|fail/i);
  });

  it("reports the current streak directly when it's active", () => {
    const text = summarizeStreakCard({ current: 4, longest: 4, totalActiveDays: 4 });
    expect(text).toMatch(/4-day/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/progress/dashboardStreakCard.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/progress/dashboardStreakCard.ts`, then wire the dashboard card**

```typescript
import type { StreakStats } from "./progressService";

export function summarizeStreakCard(stats: StreakStats): string {
  if (stats.current > 0) return `${stats.current}-day check-in streak.`;
  if (stats.longest > 0) return `Your best streak: ${stats.longest} days — start a new one today.`;
  return "No check-in streak yet — visit your plan to get started.";
}
```

In `dashboard/page.tsx`: replace `const streak = await getCurrentStreak();` with `const streakStats = await getStreakStats();`, use `summarizeStreakCard(streakStats)` in the existing "Progress" card's text, and add `longest`/`totalActiveDays` as two small stat lines beneath it plus an achievements row: `computeAchievements(streakStats.longest).map(a => ...)` rendered as small badge pills (`bg-warning-light text-warning` for unlocked, `bg-surface-page text-ink-muted` for locked, per the spec's amber-for-achievements color direction), label `"{a.days}d"`.

- [ ] **Step 4: Run test to verify it passes, then the full suite, tsc, and build**

Run: `npx vitest run tests/lib/progress/dashboardStreakCard.test.ts`
Expected: PASS

Run: `npx vitest run && npx tsc --noEmit`
Expected: full suite passes, `tsc` clean.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/dashboard/page.tsx" src/lib/progress/dashboardStreakCard.ts tests/lib/progress/dashboardStreakCard.test.ts
git commit -m "feat: add longest-streak/achievements to the dashboard"
```

---

### Task 9: Final integration pass

**Files:**
- None created — verification only.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 2: Run a production build**

Run: `npx prisma generate && npx tsc --noEmit && npm run build`
Expected: builds without type errors; `/api/cron/daily-reminders` appears in the route list; no `crons` validation error from Vercel's build step (if Vercel's Hobby-tier cron frequency limit rejects the hourly schedule at deploy time rather than build time, this will only surface during the actual `vercel deploy` in Task 10 of the controller's dispatch process, not here — report it there if so, do not assume it locally).

- [ ] **Step 3: Visual/accessibility sanity check, or its code-level substitute**

With `npm run dev` running (and `CRON_SECRET` set in `.env` for local testing), open `/profile`, set notification preferences to WhatsApp without checking consent and confirm the save is rejected with a visible error; check the consent box, save, confirm it succeeds; open `/progress` and confirm the activity calendar renders (or shows the honest empty message for a fresh account); open `/dashboard` and confirm the streak card shows longest-streak copy and achievement badges. If live browser verification is blocked, substitute a direct code read-through confirming each Review Focus item's handling is visible in the rendered JSX, and say explicitly that this was a substitution.

- [ ] **Step 4: Commit (only if the sanity check required fixes)**

```bash
git add -A
git commit -m "fix: address issues found in Phase 5 final integration pass"
```

(Skip this step entirely if nothing needed fixing.)
