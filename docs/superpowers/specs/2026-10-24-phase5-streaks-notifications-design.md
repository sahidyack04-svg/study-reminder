# Phase 5 — Streaks/Achievements, Notification Preferences, Scheduled Reminders

Status: approved (human partner opted out of the brainstorming Q&A for this
scope; proceeding with the defaults stated below)
Date: 2026-10-24
Owner: sahidyack04@gmail.com
Repo: https://github.com/sahidyack04-svg/study-reminder
Builds on: Phases 1-4 (auth, daily core loop, journal/progress, assessments)

## Intent and scope

The human partner's request covered eight phases (email reliability,
WhatsApp, streaks/achievements, UI, scheduling, testing, deployment,
report). Two of those are genuinely blocked on resources only the human
partner can provide: real email delivery needs their Resend API key
(requested repeatedly this session, not yet supplied), and WhatsApp needs
a Meta Business Platform account (business verification, a sender
number, approved message templates) that does not exist yet and that I
should not create on their behalf. Building a fake "integration" against
credentials that don't exist would violate the project's own standing
rule against claiming delivery that was never verified.

This spec scopes the session's actual build to what is genuinely
buildable right now, with no new external account required:

1. **Longest streak + total active days** (extends the existing, already
   browser- and server-verified current-streak system from Phase 3).
2. **Milestone achievements** (3/7/14/30/60/100 days), computed, not
   stored.
3. **A weekly/monthly activity calendar** on the dashboard/progress area.
4. **A real notification-preferences settings UI** — the `ReminderPreference`
   table has existed since Phase 1 but is write-only (set once during
   onboarding, never shown or editable again, never acted on by anything).
   This phase makes it a real, editable settings section.
5. **Scheduled daily reminders via Vercel Cron**, wired to the *existing*
   `sendEmail()` function. This is genuinely functional code, not a
   mockup — the moment Resend credentials are added, it starts actually
   delivering. Until then it behaves exactly like every other email path
   in this app: honest "no provider configured" non-delivery, logged
   safely.
6. **WhatsApp consent and preference collection only** — an opt-in
   toggle, phone number with validation, and a clear consent statement,
   persisted to `ReminderPreference`. The scheduled job recognizes a
   `whatsapp`-channel preference and logs an honest "no WhatsApp provider
   configured" skip, the same pattern as unconfigured email. No message
   is ever sent, no claim of delivery is made.

**Out of scope for this phase** (unchanged from the broader request, but
explicitly not attempted here because they require external setup):
actual WhatsApp message sending, achievement-unlock toast notifications
in real time (this requires tracking previous-vs-current state across
requests, which adds real complexity for low value at this stage — the
dashboard shows earned badges as a static list instead), a dedicated
`/settings` top-level nav item (folded into the existing `/profile`
page instead, to avoid growing the sidebar for one settings section —
my call, consistent with the existing six-item nav).

## Data model

Two schema additions, zero destructive changes — `prisma migrate dev`
only ever adds columns/tables here, never drops existing data.

- **`ReminderPreference`** gains three nullable columns: `quietHoursStart`,
  `quietHoursEnd` (both `"HH:mm"` strings, null = no quiet hours
  configured), and `whatsappConsentGivenAt` (`DateTime?`, null until the
  student explicitly opts in — this is the audit trail the consent
  requirement implies).
- **`ReminderLog`** (new) — `id`, `studentProfileId`, `date` (UTC-midnight
  calendar date, same convention as `PlanEntry`/`JournalEntry`),
  `channel` (`"email"` | `"whatsapp"`), `delivered` (`Boolean`),
  `createdAt`. One row per (student, date, channel) attempt —
  `@@unique([studentProfileId, date, channel])` is the idempotency
  backstop: a retried or duplicate cron invocation cannot send the same
  student two reminders for the same day on the same channel, enforced
  by the database itself, not just application logic (mirrors the
  Postgres-advisory-lock pattern already used for `checkRateLimit` this
  session — same class of problem, same proven fix).

No new table for achievements: badge status is `longestStreakEver >=
threshold`, computed on read. Storing "earned at" timestamps is real
scope (notification-worthy unlock events, a dedicated endpoint to mark
them seen) that this phase explicitly defers.

## Streak extensions

`src/lib/progress/streak.ts`'s existing `computeStreak` (current streak,
already correct and twice independently reviewed) is unchanged. New pure
function `computeLongestStreak(days: DayEntries[]): number` in the same
file: same day-ordered input shape, but instead of stopping at the first
broken day, it tracks the longest unbroken run found anywhere in the
walk and returns that. `progressService.ts`'s `getCurrentStreak()` is
renamed in spirit but kept as the same function name for backward
compatibility with every existing caller (the dashboard card, the
`/progress` page); a new `getStreakStats()` returns
`{ current: number; longest: number; totalActiveDays: number }` by
reusing the same 365-day-lookback `PlanEntry` query `getCurrentStreak`
already makes (one query, three derived numbers, no duplicate DB
round-trip). `totalActiveDays` = count of days in that window where
`computeStreak`'s own "fully checked in" rule would count them as a
streak day (every entry non-pending) — the same definition "qualifying
study day" already uses elsewhere in this app, not a new, looser
definition that would make total-days diverge in meaning from the
streak it's displayed beside.

Anti-abuse: streak days are already defined as "every `PlanEntry` for
that day is non-pending" (Phase 3's rule) — this already can't be
inflated by completing one task repeatedly, since `PlanEntry` rows are
generated once per day by the planner, and `markTaskDone`/`checkInPlanEntry`
update existing rows rather than creating new ones per completion event.
No new anti-abuse logic is needed; the existing data model already
prevents it structurally.

## Achievements

Pure function in new file `src/lib/progress/achievements.ts`:

```typescript
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100] as const;
export interface Achievement {
  days: number;
  unlocked: boolean;
}
export function computeAchievements(longestStreakEver: number): Achievement[]
```

Returns one entry per milestone, `unlocked: longestStreakEver >= days`.
Dashboard renders unlocked ones as filled badges, locked ones dimmed
with "N days to go" — never shaming language for a broken streak; the
copy for 0 current / some longest streak reads "Your best streak: N
days — start a new one today," not "streak broken."

## Weekly/monthly activity calendar

Reuses `computeDailyCompletion` (Phase 3, already correct) over the
existing week/month window from `getProgressData`. Rendered as a
7-column grid (GitHub-contribution-graph style), one cell per calendar
day, fill-opacity scaled by that day's completion percent (same
sequential-magenta... no — **same validated categorical pair already in
use**, `#e87ba4` fill-opacity scaling, consistent with `CompletionChart`'s
existing bar treatment, just gridded instead of in a row). A day with no
`PlanEntry` rows (excluded from `computeDailyCompletion`, per the
existing honest-empty-day rule) renders as an empty/outlined cell, not a
0%-filled one — same distinction Phase 3 already established.

## Notification preferences UI

A new section on the existing `/profile` page (not a new nav item, see
Scope above), backed by a new `src/lib/notifications/preferences.ts`
(`getPreferences`/`updatePreferences`, same `getOwnProfile()` +
ownership-check pattern as every other module this session):

- Channel: `none` | `email` | `whatsapp` (radio group — `browser` is
  dropped from the active choices here since no browser-push
  infrastructure exists yet or is in this phase's scope; the schema
  keeps the column's existing free-text shape rather than an enum, so
  adding `browser` back later needs no migration).
- Preferred reminder time (`"HH:mm"`, student's own timezone — already
  stored on `StudentProfile`, not re-collected).
- Quiet hours start/end, optional.
- WhatsApp: phone number field (shown only when `whatsapp` is selected),
  E.164-ish validation (`+` followed by 8-15 digits — not full
  libphonenumber validation, which is out of scope for a field that
  cannot send anything yet), a consent checkbox with explicit text
  ("By enabling WhatsApp reminders, you agree to receive daily study
  reminder messages at this number. WhatsApp delivery is not yet
  configured — your preference will be saved and used once it is."),
  required before the channel can be set to `whatsapp`. Unchecking later
  clears `whatsappConsentGivenAt`.
- Save/Cancel, saved confirmation, validation errors — same established
  form pattern as `ProfileEditForm`.

## Scheduled reminders

New route `src/app/api/cron/daily-reminders/route.ts` (`POST`, or `GET` —
Vercel Cron issues `GET` by default), protected by checking the
`Authorization` header against `process.env.CRON_SECRET` (Vercel injects
this automatically for its own Cron Job requests when `CRON_SECRET` is
set as a project env var — this is Vercel's documented mechanism, not a
new one I'm inventing). Any request without a matching header returns
`401` immediately, logged, no further processing.

`vercel.json` gains a `crons` array running this route hourly
(`"schedule": "0 * * * *"`). **Known constraint to verify at deploy
time, not assumed**: Vercel's Hobby tier historically limited cron
frequency; if the deploy rejects an hourly schedule, the fallback is a
single daily UTC run and the human partner is told explicitly rather
than silently degraded.

Job logic per invocation: query every `StudentProfile` with a
`ReminderPreference` where `channel != "none"`, whose
`todayInTimezone(profile.timezone)` current local time matches
`preferredTimes` for this hour and isn't inside `quietHoursStart`–
`quietHoursEnd`; for each, inside a `$transaction` with the same
Postgres advisory-lock pattern as `checkRateLimit` (locked on
`studentProfileId:date:channel`), check `ReminderLog` for an existing
row for today+channel — if present, skip (already handled, idempotent
against retries); if absent, attempt delivery (`sendEmail` for `email`,
an honest "WhatsApp not configured" skip for `whatsapp`) and write the
`ReminderLog` row with the real `delivered` result either way. The
reminder content itself is real: today's open task count and the
nearest upcoming deadline, pulled from the same `listTasks`/
`getOrGeneratePlanForDate` functions the dashboard already uses — never
placeholder copy.

## Testing

Vitest for: `computeLongestStreak` (multiple runs in history, longest
one wins even if current streak is now shorter or zero; ties; empty
history); `computeAchievements` (threshold boundaries, 0 streak);
`preferences.ts` (ownership scoping including an explicit cross-student
test, phone validation accepted/rejected cases, consent-cleared-on-
whatsapp-disabled); the cron route's selection logic (which students
match the current hour+timezone+quiet-hours, with mocked
`getCurrentSessionUser`-equivalent — this route has no session, it
checks `CRON_SECRET` instead, so its own dedicated authorization test:
missing/wrong header → 401, no DB touched) and idempotency (two
invocations for the same student+date+channel → only one `ReminderLog`
row, only one `sendEmail` call, via the same unique-constraint-backed
transaction pattern `rateLimit.test.ts` already proved under real
concurrency this session). RTL for the activity calendar's empty-cell
vs. filled-cell rendering and the notification-preferences form's
validation/save/consent-toggle behavior.

## Secrets & environment variables

One new variable: `CRON_SECRET` (a random string, generated the same
way `AUTH_SECRET` was — not provided by the human partner, generated
and set directly in Vercel without being echoed in chat). No WhatsApp
provider credentials exist yet; that remains explicitly blocked pending
the human partner's own Meta Business Platform account, consistent with
"never claim delivery that hasn't been verified."
