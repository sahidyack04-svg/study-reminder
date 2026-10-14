# Phase 1 — Foundation: Auth, Database, Onboarding

Status: approved for spec; implementation plan pending
Date: 2026-10-14
Owner: sahidyack04@gmail.com
Repo: https://github.com/sahidyack04-svg/study-reminder (empty at time of writing)

## Context

This is phase 1 of a multi-phase build of "Study Reminder," a student study
planner and daily reminder web app. The full feature set (study plan
generator, daily check-ins, task tracking, school journal, progress
dashboards, monthly assessments, scheduled notifications, WhatsApp
integration) is too large for one spec, so it is decomposed into phases.
This document covers Phase 1 only: project scaffold, database, auth, and
student onboarding. Later phases (daily core loop, journal/dashboard,
assessments, notifications, WhatsApp, deploy) are separate specs built on
top of this foundation.

The app supports **open public signup** — any student can register, not
just a fixed family account — so auth must include email verification and
reasonable abuse hardening from the start.

## Decisions carried in from brainstorming

- **Framework:** Next.js (App Router, TypeScript), deployed to Vercel.
- **Database:** Postgres via Prisma ORM. **Vercel Postgres** is used for
  both local development and production — a single free Vercel Postgres
  database is created up front and its `DATABASE_URL` is used locally too,
  since native Postgres and Docker are not available on the dev machine.
- **Auth:** Auth.js v5, Credentials provider (email + bcrypt-hashed
  password), **database-backed sessions** via the Prisma adapter (not
  JWT) so sessions can be revoked server-side.
- **Styling:** Tailwind CSS, soft pastel pink / lavender / cream / white
  theme per the product brief.
- **Testing:** Vitest + React Testing Library for unit/component tests.
- **Email:** Resend for transactional email (verification, password
  reset, guardian consent) in production. `RESEND_API_KEY` is optional in
  development — when absent, outgoing emails are written to the server
  log and surfaced on a dev-only `/dev/emails` page instead of actually
  sending, so the full flow is testable without external credentials.
- **Guardian consent age threshold:** under 18.

## Data model (Phase 1 slice)

Tables created this phase (Prisma schema), designed so later phases add
new tables (`Task`, `CheckIn`, `JournalEntry`, `TestResult`,
`ReminderLog`, etc.) without migrating these:

- `User` — id, email (unique), passwordHash, emailVerified (timestamp or
  null), createdAt, updatedAt.
- `VerificationToken` — token, userId, purpose (`email_verify` |
  `password_reset`), expiresAt. Single-use, deleted on consumption.
- `Session` / `Account` — Auth.js Prisma-adapter standard tables for
  database sessions.
- `StudentProfile` — userId (1:1 with User), name, dateOfBirth, grade,
  schoolName, curriculum, academicYear, gender (nullable, with explicit
  "prefer not to say"), timezone, onboardingCompletedAt.
- `Guardian` — studentProfileId, name, email, consentToken,
  consentRequestedAt, consentGivenAt (nullable). Only created when the
  student's computed age at signup is under 18.
- `Subject` — studentProfileId, name, order.
- `TimetableEntry` — studentProfileId, dayOfWeek, subjectId (nullable —
  may be a non-subject school period), startTime, endTime. Validated to
  not overlap other entries on the same day for the same student.
- `AvailabilityWindow` — studentProfileId, dayOfWeek, startTime, endTime
  (the student's daily at-home study availability).
- `Goal` — studentProfileId, subjectId (nullable), description, examDate
  (nullable).
- `ReminderPreference` — studentProfileId, channel (`browser` | `email` |
  `whatsapp` | `none`), preferredTimes (array of time-of-day), phone
  (nullable, only populated when channel is `whatsapp` or an SMS/phone
  channel is chosen).

All student-owned tables carry a foreign key back to `StudentProfile` (and
transitively to `User`) so row-level access can always be checked against
`session.user.id`. No cross-student reads are possible through the Phase 1
API surface.

## Auth & guardian consent flow

1. **Sign up** — email + password (+ confirm password). Password policy:
   minimum 10 characters, checked against a short deny-list of common
   passwords. Account is created with `emailVerified = null`.
2. **Email verification** — a `VerificationToken` (purpose
   `email_verify`, 24h expiry) is created and emailed (or logged, in dev).
   The user cannot log in to the authenticated app until verified; a
   `/verify-email` page explains this and offers "resend."
3. **Login** — Auth.js Credentials provider checks bcrypt hash and
   `emailVerified`. Failed attempts are rate-limited per email+IP (simple
   in-memory/DB counter is sufficient for Phase 1; revisit if abuse is
   observed).
4. **Password recovery** — `/forgot-password` issues a `password_reset`
   token (1h expiry, single-use) by email; `/reset-password` consumes it.
5. **Onboarding wizard** (first login after verification) collects the
   `StudentProfile` fields and child records listed above, step by step,
   with per-step validation and the ability to go back. Age is computed
   from DOB entered in step 1.
6. **Guardian consent (age < 18)** — onboarding requires guardian name +
   email before it can be marked complete. On submission, a consent email
   (or dev-log entry) is sent to the guardian with a one-time link to
   `/guardian-consent/[token]` (no login required) where they can approve.
   Until `consentGivenAt` is set, the student's dashboard shows a visible
   "awaiting guardian approval" banner and locks any feature that would
   be built in later phases (Phase 1 itself has no gated features yet
   beyond the banner); a "resend consent email" action is available,
   rate-limited to prevent spam.
7. **Profile editing** — a `/profile` page lets the student update any
   onboarding answer later (re-triggers guardian consent only if DOB
   changes such that age crosses the 18 threshold in the under-18
   direction, or if guardian contact info changes).

## Pages in scope for Phase 1

`/` (welcome/landing), `/signup`, `/login`, `/verify-email`,
`/forgot-password`, `/reset-password`, `/guardian-consent/[token]`,
`/onboarding` (multi-step), `/dashboard` (profile summary card +
clearly-labeled "more features arrive in later phases" placeholders —
no fabricated tasks/plans/charts), `/profile` (edit onboarding answers),
`/dev/emails` (dev-only, hidden/disabled when `RESEND_API_KEY` is set).

## Out of scope for Phase 1 (future phases)

Study plan generation, task tracking, daily check-ins, school journal,
progress dashboards/charts, monthly assessments, push/email/WhatsApp
reminder scheduling, and any Vercel deployment. The dashboard shell must
not simulate these — it shows only real onboarding data plus honest
"coming soon" placeholders.

## Testing

Vitest unit tests for: password policy validation, age/guardian-threshold
calculation, timetable-overlap validation, token expiry logic. React
Testing Library for the onboarding wizard's step validation and the
guardian-consent page. No e2e framework introduced yet (can be added in
a later phase if needed).

## Setup requirements (external, needed before implementation can run)

1. A free Vercel Postgres database, created via the Vercel dashboard
   (Storage → Postgres) — needed to obtain a `DATABASE_URL` for local
   `prisma migrate dev`. No app deployment is required to create this.
2. Optional at this phase: a Resend API key (`RESEND_API_KEY`) — without
   it, emails are logged to the console and viewable at `/dev/emails`
   instead of actually sending. Required before Phase 1 can be considered
   fully production-ready, but not required to build or preview locally.

Both will be requested explicitly, with exact steps, at the point the
implementation plan needs them — not before.

## Secrets & environment variables

`.env.example` will list (names + placeholder values only):
`DATABASE_URL`, `AUTH_SECRET` (Auth.js session encryption secret),
`RESEND_API_KEY` (optional), `RESEND_FROM_EMAIL` (optional),
`NEXT_PUBLIC_APP_URL`. No real secrets are committed; `.env` is
git-ignored.
