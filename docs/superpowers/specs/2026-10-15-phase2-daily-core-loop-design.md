# Phase 2 — Daily Core Loop: Tasks, Study Plan, Check-in, Follow-up

Status: approved for spec; implementation plan pending
Date: 2026-10-15
Owner: sahidyack04@gmail.com
Repo: https://github.com/sahidyack04-svg/study-reminder
Builds on: Phase 1 (`docs/superpowers/specs/2026-10-14-phase1-foundation-design.md`)

## Context

Phase 1 built the foundation: auth, onboarding (which collects subjects,
weekly timetable, at-home availability windows, and goals), a dashboard
shell, and profile editing — but the dashboard's "Study plan" and
"Homework & tasks" sections are honest placeholders with no real
functionality behind them yet.

Phase 2 is the first phase that makes the app actually useful day to day:
students enter homework/tasks, the app turns that into a daily study plan
using the availability data already collected at onboarding, and the
student checks off what they completed — carrying anything unfinished
into tomorrow automatically. This is the "daily core loop" the product
is built around; later phases (journal, assessments, notifications) all
sit on top of it.

Decided in brainstorming:

- **Study plan is auto-generated, not a plain to-do list.** The system
  turns open tasks plus the student's declared availability into a
  specific daily plan, rather than just letting the student sort their
  own list. This is what makes the "personalized study planner" claim
  real.
- **Check-in is task-completion only, not reflection/journaling.** A
  mood/reflection layer is explicitly left for Phase 3's school journal,
  to avoid building two overlapping journaling surfaces.
- **Unfinished tasks roll forward automatically** into the next day's
  generated plan — no separate "catch-up" list the student has to
  remember to check.
- **Tasks carry an estimated duration.** Without it, the generator could
  only sort by due date, not actually fit work into available time —
  which would make "auto-generated schedule" a much weaker claim.
- **Goals (from onboarding) can generate filler study blocks** when
  their target date is approaching and there's otherwise-unused
  availability, so the goal data collected at onboarding isn't inert.

## Data model (Phase 2 slice)

Two new tables, plus one existing table reused as a generation input:

- `Task` — studentProfileId, subjectId (nullable — some homework isn't
  tied to a subject), title, dueDate (nullable — not all homework has a
  hard deadline), estimatedMinutes, status (`open` | `done`), createdAt,
  updatedAt. Scoped by studentProfileId per the existing project-wide
  convention (no cross-student access).
- `PlanEntry` — one row per generated line-item on a specific date:
  studentProfileId, date, taskId (nullable — null for a goal-filler
  entry), goalId (nullable — set only for filler entries), subjectId,
  title, and estimatedMinutes (these three are denormalized snapshots of
  the source task/goal's values at generation time, so a later edit to
  the task doesn't rewrite an already-generated day's history),
  checkInStatus (`pending` | `done` |
  `partial` | `not_done`), carriedOverFromDate (nullable — set when this
  entry exists because a previous day's entry was left not-done or
  partial), createdAt.
- `Goal` (already exists from Phase 1's `StudentProfile` relations) — its
  `examDate` field becomes a generation input: a goal with no existing
  open task and a target date within the lookahead window (14 days) is
  eligible for a filler `PlanEntry`.

`PlanEntry` rows are generated once per (student, date) and then persisted
— regenerating a date that already has entries is never done implicitly.
This keeps check-in history (and the "carried over" chain) stable even if
the student edits tasks or availability after the fact.

## Generation algorithm

Triggered lazily: the first time a student visits `/plan` for a date with
zero existing `PlanEntry` rows, the plan for that date is generated and
persisted before rendering. (Not a background job — Phase 2 has no
scheduler; that's Phase 5's concern.)

For a given student and date:

1. **Carry-forward candidates.** Find yesterday's `PlanEntry` rows with
   `checkInStatus` of `partial` or `not_done` AND a non-null `taskId`
   whose task is still `open`. These go first, each producing a new
   `PlanEntry` for today with `carriedOverFromDate` set to yesterday's
   date. Goal-filler entries (`taskId` null) never carry forward —
   they're an opportunistic suggestion for that specific day, not a
   commitment, so an unfinished one simply lapses rather than growing an
   ever-present backlog of vague "study for `<goal>`" blocks. The goal
   remains eligible to generate a fresh filler entry on a later day if
   it's still within the 14-day lookahead window.
2. **Open tasks.** All remaining open `Task` rows not already represented
   by a carry-forward, sorted by `dueDate` ascending (tasks with no due
   date sort last).
3. **Goal filler.** `Goal` rows with an `examDate` within 14 days that
   have no associated open task, limited to at most one filler entry per
   day so the plan doesn't fill up entirely with speculative study blocks
   ahead of concrete homework.
4. **Capacity.** Sum the day's `AvailabilityWindow` rows for that weekday
   (in minutes). Walk the ordered candidate list from steps 1–3, placing
   each item's `estimatedMinutes` into the remaining capacity until it's
   exhausted or the candidates run out. Items that don't fit are simply
   not placed that day — no error, no partial entries; they remain
   eligible tasks/goals for a future day's generation. A task is never
   split across multiple `PlanEntry` rows or days to fill partial
   capacity — it either fits whole in the remaining time or it waits for
   a day with more room.
5. **Persist.** Write the placed items as `PlanEntry` rows for that date,
   each starting at `checkInStatus: "pending"`.

Zero availability for a weekday is a valid, non-error outcome: the
generated plan is simply empty, and the `/plan` page says so explicitly
rather than rendering a blank section (see Error handling below).

## Check-in flow

There is no separate check-in form or end-of-day ritual. `/plan` *is* the
check-in surface: each of today's `PlanEntry` rows has an inline control
to mark it `done`, `partial`, or `not_done` (default `pending` until
touched), updatable at any time during the day. Marking a `PlanEntry`
`done` when it has a `taskId` also marks the underlying `Task` `status:
"done"` — the task and its plan entry can never disagree about
completion. Marking `partial` or `not_done` leaves the task `open`,
making it eligible for tomorrow's carry-forward step.

A student can also mark a `Task` done directly from `/tasks` (outside the
plan view, e.g. for a task that wasn't on today's generated plan at all).
When that happens, any of that task's still-`pending` `PlanEntry` rows
(today's, if one exists) are updated to `done` too, so the two views
never show contradictory state for the same task.

## Pages in scope

- `/tasks` — list, add, edit, delete homework/tasks. Fields: title,
  subject (dropdown from the student's onboarding subjects), due date
  (optional), estimated minutes. Scoped to the signed-in student's
  session, following the same `getCurrentSessionUser()` pattern as every
  Phase 1 server action.
- `/plan` — today's generated plan (lazily generated on first visit, per
  above), with inline check-in controls. Carried-over entries show a
  small "carried over from `<date>`" indicator. A date with zero
  capacity shows an explicit "No study time set for today" message
  linking to `/profile` rather than rendering nothing.
- `/dashboard` — the existing "Study plan" and "Homework & tasks"
  placeholder sections (Phase 1) become real summary cards (today's plan
  item count / completion, open task count) linking to `/plan` and
  `/tasks`. This is the only Phase 1 file this phase modifies.

## Error handling / edge cases

- **Empty availability.** Plan generates with zero entries; `/plan`
  explains why instead of showing a bare empty state.
- **Task completed outside the plan view.** Handled by the
  task↔plan-entry sync described above — no divergent state.
- **Task edited/deleted after being carried into a future (ungenerated)
  day.** Since carry-forward only looks at yesterday's actual
  `PlanEntry` rows (not at the task table directly) when generating
  *today*, editing a task's title/duration after today's plan is already
  generated does not retroactively change today's entry (consistent with
  "persisted once, not regenerated"). Deleting a task whose `PlanEntry`
  is still `pending` leaves that `PlanEntry` as an orphaned-but-harmless
  historical record (its denormalized `title` snapshot still renders
  correctly); it simply won't be a carry-forward candidate tomorrow since
  the carry-forward check requires the task to still exist and be open.
- **Student never visits `/plan` on a given day.** No `PlanEntry` rows
  are generated for that date at all (generation is visit-triggered, not
  scheduled) — nothing to carry forward from a day that was never
  generated; the next real visit generates fresh from whatever tasks are
  still open at that time. This is an accepted Phase 2 limitation, not a
  bug: Phase 5 (notifications) is where a daily nudge/scheduled
  generation could be added.

## Out of scope for Phase 2 (future phases)

School journal, progress charts/reports, monthly assessments, scheduled
background generation or push/email/WhatsApp reminders (Phase 5),
spaced-repetition or performance-weighted scheduling (no scoring data
exists until Phase 4). The generator is deliberately a simple greedy
fit — see "Decisions" above.

## Testing

Vitest unit tests for the generator as a pure function (given tasks,
goals, availability windows, and yesterday's carry-forward candidates →
produces the correct ordered, capacity-respecting list of entries, with
no database involved) — this is the highest-value test surface since it's
where the actual logic lives. Prisma-mocked tests for the
database-touching wrapper functions (lazy-generate-if-missing,
task↔plan-entry sync). React Testing Library for `/tasks` CRUD
interactions and `/plan`'s check-in controls and empty-availability
state.

## Secrets & environment variables

None new. This phase introduces no new external services.
