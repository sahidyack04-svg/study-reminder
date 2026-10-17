# Phase 3 — Journal & Dashboard Progress Charts

Status: approved for spec; implementation plan pending
Date: 2026-10-17
Owner: sahidyack04@gmail.com
Repo: https://github.com/sahidyack04-svg/study-reminder
Builds on: Phase 1 (auth/onboarding/dashboard), Phase 2 (`docs/superpowers/specs/2026-10-15-phase2-daily-core-loop-design.md`)

## Context

Phase 2 gave the app its daily core loop — tasks, an auto-generated study
plan, and inline check-in — but all of that activity is currently
write-only from the student's perspective: nothing looks back at it.
Phase 3 adds a place to reflect (`/journal`) and a place to see the
accumulated pattern of real activity (`/progress`), both read against data
Phase 2 already collects. No new external data source, no fabricated
numbers, no test-score charts — those don't exist until Phase 4.

Decided in brainstorming:

- **Journal entries are free-form, one per calendar day, editable.**
  No fixed reflection prompts. Writing again on a day that already has an
  entry updates it rather than creating a second one — mirrors how
  `PlanEntry` already works (one row per student per date), not a
  multi-entry diary log.
- **Charts are built entirely from Phase 2's real data** (`PlanEntry`,
  `Task`) plus this phase's own `JournalEntry` table — never from
  placeholder or future-phase data. No "test scores coming soon" slot is
  added; Phase 4 introduces its own dashboard section when it exists.
- **One `/progress` page, not separate weekly/monthly pages.** A
  Week/Month toggle re-aggregates the same three visualizations (daily
  completion, time-by-subject, streak) over a 7-day or 30-day window —
  one component tree, not two layouts to keep in sync.
- **Charts are hand-rolled inline SVG, not a charting library.** The app
  has zero chart dependencies today and a single fixed pastel light theme
  (no dark mode anywhere). Adding a library (Recharts etc.) for three
  simple bar charts and a stat tile is more than this phase needs; the
  project's dataviz skill's own guidance is plain-HTML/SVG-first
  regardless, so hand-rolling costs nothing extra and keeps the dependency
  surface at zero.

## Data model (Phase 3 slice)

One new table:

- `JournalEntry` — `studentProfileId`, `date` (UTC-midnight-anchored
  calendar date, parsed and read the same way `PlanEntry.date` already is
  — see Phase 2's Global Constraints, which this phase inherits
  unchanged), `content` (free text), `createdAt`, `updatedAt`. Unique per
  (`studentProfileId`, `date`) at the application level, same pattern as
  `PlanEntry`'s one-row-per-day-per-student convention (no DB-level
  `@@unique` is added here either, consistent with the ledgered decision
  not to add one for `PlanEntry` while still SQLite-only — see Phase 2's
  final-review ledger).

No other new tables. `/progress`'s charts are computed on read from
existing `PlanEntry`/`Task` rows plus a simple "was there a `JournalEntry`
this day" boolean where relevant — nothing is persisted that could drift
from the source data.

## `/journal` page

- Today's entry (if one exists) shown in an editable textarea with a Save
  button; if none exists yet, an empty textarea ready to create one.
  Saving calls an upsert (create-or-update) scoped to the signed-in
  student's profile and today's date — same ownership-check discipline as
  every Phase 2 mutator (resolve the session server-side, never trust a
  client-supplied id; this phase introduces no new trust boundary).
- Past entries (everything before today) are listed below in reverse
  chronological order, read-only display — no edit affordance on past
  days, matching "one entry per day, editable" (editable means *today's*
  entry is editable while it's still today, not that history can be
  silently rewritten).
- Entries are private: scoped to `studentProfileId`, readable only by the
  owning student's own session — no entry is ever exposed by id to a
  request that doesn't already carry the right session.

## `/progress` page

A Week (last 7 days) / Month (last 30 days) toggle controls the window for
all three pieces below. "Last N days" is inclusive of today (today's
real, so-far data counts; it is not excluded just because the day isn't
over). Switching the toggle re-fetches/re-aggregates; it does not
navigate to a different route.

### 1. Daily completion chart

One bar per calendar day in the window. A day's value is the percentage
of that day's `PlanEntry` rows with `checkInStatus === "done"` out of all
`PlanEntry` rows generated for that day. **A day with zero generated
`PlanEntry` rows (e.g. no availability configured, or the student never
visited `/plan` that day) is excluded from the chart entirely — it is
not plotted as a 0% bar**, consistent with the Phase 2 principle that
"no plan generated" and "plan generated but not done" are different,
honestly-distinguished states.

### 2. Time-by-subject chart — planned vs. actual

For each subject with any `PlanEntry` activity in the window, two
figures, computed precisely as follows. `PlanEntry` rows with a null
`subjectId` (an unassigned task, or a goal-filler entry whose goal has no
subject) are excluded from this chart entirely — there is no subject to
group them under, and inventing an "Unassigned" bucket is not needed for
this phase's scope.

- **Planned minutes** = sum of `estimatedMinutes` across *all* that
  subject's `PlanEntry` rows in the window, regardless of
  `checkInStatus`. This is what was scheduled.
- **Actual minutes studied** = sum of `estimatedMinutes` across only
  that subject's `PlanEntry` rows with `checkInStatus === "done"` in the
  window. `partial` and `not_done` entries contribute to Planned but not
  to Actual — the schema only records a completion *status*, not a
  partial-completion duration, so a `partial` entry's actual minutes are
  genuinely unknown and are not estimated or guessed at.

Rendered as paired bars per subject (Planned, Actual) — not a dual-axis
chart, since both figures share the same unit (minutes) and scale. Two
categorical colors distinguish the pair consistently across every
subject (not a different color per subject), with a legend naming both
series, per the dataviz skill's identity-is-never-color-alone rule.

### 3. Check-in streak

A stat tile (a single number, not a chart — per the dataviz skill, a
headline figure is sometimes correctly not a chart), with this exact,
unambiguous calculation:

1. Walk backward day by day starting from today.
2. A day with **zero** `PlanEntry` rows is **skipped** — it neither
   extends nor breaks the streak (the student had nothing to check into
   that day, e.g. no availability configured).
3. A day with **at least one** `PlanEntry` row where **all** of that
   day's rows have `checkInStatus !== "pending"` (every entry was
   touched — `done`, `partial`, or `not_done` all count as "checked in";
   only an untouched `pending` row counts as not-yet-checked-in) is a
   **streak day** — the count increments and the walk continues to the
   previous day.
4. A day with at least one `PlanEntry` row where **any** row is still
   `pending` **ends the walk**. Exception: if that day is **today**,
   today is simply not yet countable (the day isn't over) — today is
   excluded from the count without ending the streak, and the walk
   continues from yesterday as if today had been skipped.
5. The streak is the total count of streak days found before the walk
   ended (step 4, for a day other than today) or ran out of history.

This defines "streak" as "fully processed your daily check-in," not "did
all the work" — marking things `not_done` honestly still extends the
streak, since the point is maintaining the habit of reviewing the plan,
not punishing an honest "I didn't get to this."

### Empty-data handling

If the window has no `PlanEntry` activity at all (new student, or a
window entirely before onboarding completed), the completion chart and
time-by-subject chart both show an explicit "No study activity yet in
this period" message instead of rendering an empty or zero-filled chart
that could be misread as a real (bad) result. The streak tile shows `0`
honestly in that case (0 is a real, correct answer, not a placeholder).

## Dashboard integration

The existing "Progress reports" placeholder (left honest in Phase 2)
becomes a real summary card — current streak count plus a link to
`/progress` — following the exact pattern already established for the
"Study plan" and "Homework & tasks" cards in Phase 2's Task 7.

## Pages in scope for Phase 3

`/journal`, `/progress`. One modification to an existing page:
`/dashboard` (its "Progress reports" placeholder becomes real).

## Out of scope for Phase 3 (future phases)

Monthly test/assessment data and any chart of it (Phase 4). Scheduled or
push notifications (Phase 5). Journal search, tagging, or mood/prompt
fields (explicitly decided against in brainstorming — free-form only).
Editing a past (non-today) journal entry.

## Testing

Vitest unit tests for the three chart aggregation functions as pure
functions (given raw `PlanEntry`/`Task` rows for a window → the
chart-ready numbers), covering: the zero-`PlanEntry`-day exclusion rule
for the completion chart; the planned-vs-actual split for the
time-by-subject chart (including a subject with only `partial`/`not_done`
entries, which must show nonzero Planned and zero Actual); and the streak
calculation's skip/break/today-exception rules explicitly, including the
boundary case of today having pending entries (today excluded, walk
continues) versus today being fully checked in (today counted). Prisma-
mocked tests for the data-layer wrapper functions and the journal
upsert's ownership scoping, including an explicit cross-student-access
test following the pattern already established in every Phase 2 data
module. React Testing Library for `/journal`'s save/display behavior and
`/progress`'s Week/Month toggle and empty-state rendering.

## Secrets & environment variables

None new. This phase introduces no new external service.
