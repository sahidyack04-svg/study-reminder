# Phase 1 — Foundation: Auth, Database & Onboarding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a working Next.js + Prisma app where a student can sign up, verify their email, complete guardian consent if under 18, complete a multi-step onboarding wizard, log in, see a real (not simulated) dashboard shell, and edit their profile later — all running locally against a real database, deployable later but **not deployed in this phase**.

**Architecture:** Next.js (App Router, TypeScript) with Prisma/SQLite for local persistence (Postgres at actual deployment time — see the spec's "SQLite ↔ Postgres portability" section for the two schema choices that keep this swap simple, and the one part that isn't automatic), Auth.js (Credentials provider, JWT sessions with a DB-checked revocation flag — see Task 5), Tailwind for the pastel design system, and Resend for transactional email in production (falling back to a dev-only in-app inbox when `RESEND_API_KEY` is absent).

**Tech Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS · Prisma (`sqlite` connector for local dev; `postgresql` at deployment) · Auth.js v5 (`next-auth@beta`) · bcryptjs · Resend · Vitest + Testing Library

**Spec:** `docs/superpowers/specs/2026-10-14-phase1-foundation-design.md`

## Roadmap (context only — not implemented in this plan)

Phase 1 is the first of seven phases for the full Study Reminder product. Each later phase gets its **own** brainstorming → spec → plan cycle before any code is written for it:

2. **Daily core loop** — task tracker, study plan generator, daily check-in, next-day follow-up
3. **Journal & dashboard** — school journal, weekly/monthly progress reports and charts
4. **Assessments** — monthly tests, question bank, scoring and weak-topic analysis
5. **Notifications** — browser push + scheduled reminders (Vercel Cron, timezone-aware, idempotent)
6. **WhatsApp integration** — WhatsApp Business Platform, credentials via env vars, delivery logging
7. **Deploy** — connect the existing GitHub repo to Vercel, after you approve a local preview

## Global Constraints

- Password policy: minimum 10 characters, rejected if on a common-password deny-list (spec §Auth).
- Login is blocked until `User.emailVerified` is set (spec §Auth flow step 3).
- Email verification token: 24h expiry, single-use, deleted on consumption (spec §Auth flow step 2).
- Password reset token: 1h expiry, single-use, deleted on consumption (spec §Auth flow step 4).
- Guardian consent required exactly when computed age **< 18** at the relevant date (spec: "under 18").
- Sessions must be revocable server-side (spec: "revocable server-side") — implemented as JWT + DB-checked `sessionVersion`, per the session-strategy decision above, since Auth.js disallows true database sessions with the Credentials provider.
- No fabricated data anywhere: the dashboard shows only real onboarding data plus honestly-labeled "coming in a later phase" placeholders (spec §Out of scope).
- Secrets never committed; `.env` is git-ignored; `.env.example` holds only placeholder values (spec §Secrets).
- Every student-owned table is scoped by `studentProfileId` → `userId`, and every read goes through the current session's user id — no cross-student access (spec §Data model).
- Do not deploy to Vercel and do not push to GitHub during this phase — commit locally only, per explicit user instruction.

## Review Focus

- **Expired or already-consumed verification/reset token submitted** — must show a clear, specific error ("invalid or expired") and never silently verify/reset or crash. Covered in Task 6 (`verifyEmailToken`) and Task 7 (`resetPassword`).
- **Unverified user attempts login with the correct password** — must be rejected with a message pointing at email verification, not a generic "invalid credentials" that hides the real reason. Covered in Task 5 (`verifyCredentials`).
- **Student's age is exactly 18 at signup/profile-edit time** — must NOT require guardian consent (threshold is strictly "< 18"); an off-by-one here would needlessly block or wrongly free an 18-year-old. Covered in Task 3 (`age.test.ts`) and Task 9 (`completeOnboarding.test.ts`).
- **A guardian-consent link is reused after approval, or a token is guessed/tampered with** — re-approval must be idempotent (no error, no double side effects) and an unknown token must fail without revealing whether it ever existed. Covered in Task 8 (`guardianConsent.test.ts`).
- **Two timetable entries partially overlap (not identical ranges) on the same day, vs. the same times on different days, vs. back-to-back entries (one ends exactly when the next starts)** — only true same-day overlaps should be rejected. Covered in Task 3 (`timetable.test.ts`).

---

## File Structure

```
study reminder/
├── .env.example
├── .gitignore
├── next.config.ts
├── package.json
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
├── vitest.setup.ts
├── prisma/
│   └── schema.prisma
├── src/
│   ├── auth.ts
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── page.tsx                         (welcome/landing)
│   │   ├── signup/page.tsx
│   │   ├── verify-email/page.tsx
│   │   ├── login/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   ├── reset-password/page.tsx
│   │   ├── guardian-consent/[token]/page.tsx
│   │   ├── onboarding/page.tsx
│   │   ├── onboarding/OnboardingWizard.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── profile/page.tsx
│   │   ├── profile/ProfileEditForm.tsx
│   │   ├── dev/emails/page.tsx
│   │   └── api/auth/[...nextauth]/route.ts
│   └── lib/
│       ├── db/prisma.ts
│       ├── validation/password.ts
│       ├── validation/age.ts
│       ├── validation/timetable.ts
│       ├── validation/tokens.ts
│       ├── email/send.ts
│       ├── email/devStore.ts
│       ├── auth/verifyCredentials.ts
│       ├── auth/session.ts
│       ├── auth/revokeSessions.ts
│       ├── auth/signup.ts
│       ├── auth/verifyEmail.ts
│       ├── auth/passwordReset.ts
│       ├── onboarding/completeOnboarding.ts
│       ├── onboarding/guardianConsent.ts
│       ├── onboarding/updateProfile.ts
│       ├── dashboard/bannerState.ts
│       └── security/rateLimit.ts
└── tests/
    └── ... (mirrors src/ — one test file per module listed above)
```

---

### Task 1: Project scaffold & tooling

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `tailwind.config.ts`
- Create: `postcss.config.js`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `src/app/globals.css`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Test: `tests/app/home.test.tsx`

**Interfaces:**
- Produces: the `@/*` → `src/*` path alias used by every later task's imports.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "study-reminder",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "next-auth": "5.0.0-beta.25",
    "@auth/prisma-adapter": "^2.7.2",
    "@prisma/client": "^5.20.0",
    "bcryptjs": "^2.4.3",
    "resend": "^4.0.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "@types/node": "^22.7.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/bcryptjs": "^2.4.6",
    "tailwindcss": "^3.4.13",
    "postcss": "^8.4.47",
    "autoprefixer": "^10.4.20",
    "prisma": "^5.20.0",
    "vitest": "^2.1.2",
    "@vitejs/plugin-react": "^4.3.2",
    "@testing-library/react": "^16.0.1",
    "@testing-library/jest-dom": "^6.5.0",
    "jsdom": "^25.0.1",
    "eslint": "^8.57.0",
    "eslint-config-next": "^15.0.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: installs without errors, creates `package-lock.json`.

- [ ] **Step 3: Create config files**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`next.config.ts`:
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

`tailwind.config.ts`:
```typescript
import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FFF9F4",
        blush: "#FBE4EC",
        pink: {
          DEFAULT: "#F3A7C5",
          dark: "#D97BA3",
        },
        lavender: {
          DEFAULT: "#CDBFEF",
          dark: "#A693D6",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
```

`postcss.config.js`:
```javascript
module.exports = {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

`vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

`vitest.setup.ts`:
```typescript
import "@testing-library/jest-dom/vitest";
```

`.gitignore` (the last two lines were added post-Task-1, during Task 2, for the SQLite dev database file):
```
node_modules
.next
.env
.env*.local
*.tsbuildinfo
next-env.d.ts
prisma/dev.db
prisma/dev.db-journal
```

`.env.example` (updated post-Task-1 to reflect the SQLite decision made during Task 2 — see that task's setup note):
```
DATABASE_URL="file:./dev.db"
AUTH_SECRET="replace-with-a-long-random-string"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
RESEND_API_KEY=""
RESEND_FROM_EMAIL="Study Reminder <onboarding@resend.dev>"
```

- [ ] **Step 4: Create the root layout and global styles**

`src/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-cream text-slate-800;
}
```

`src/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Study Reminder",
  description: "A personal study companion for students.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 5: Write the failing smoke test**

`tests/app/home.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

describe("Home page", () => {
  it("welcomes the student and links to sign up and log in", () => {
    render(<Home />);
    expect(screen.getByText(/study reminder/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign up/i })).toHaveAttribute("href", "/signup");
    expect(screen.getByRole("link", { name: /log in/i })).toHaveAttribute("href", "/login");
  });
});
```

- [ ] **Step 6: Run the test and verify it fails**

Run: `npx vitest run tests/app/home.test.tsx`
Expected: FAIL — `Cannot find module '@/app/page'` (file doesn't exist yet).

- [ ] **Step 7: Create `src/app/page.tsx`**

```tsx
import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center gap-8 px-6 py-24 text-center">
      <h1 className="text-4xl font-semibold text-pink-dark">Study Reminder</h1>
      <p className="max-w-xl text-lg text-slate-600">
        Your personal study companion — plan your day, track your homework,
        and stay on top of every subject.
      </p>
      <div className="flex gap-4">
        <Link
          href="/signup"
          className="rounded-full bg-pink px-6 py-3 font-medium text-white shadow-sm transition hover:bg-pink-dark"
        >
          Sign up
        </Link>
        <Link
          href="/login"
          className="rounded-full border border-lavender px-6 py-3 font-medium text-lavender-dark transition hover:bg-blush"
        >
          Log in
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 8: Run the test and verify it passes**

Run: `npx vitest run tests/app/home.test.tsx`
Expected: PASS

- [ ] **Step 9: Verify the dev server boots**

Run: `npm run dev`, open `http://localhost:3000`
Expected: welcome page renders with pastel styling; stop the server after confirming (Ctrl+C).

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts tailwind.config.ts postcss.config.js vitest.config.ts vitest.setup.ts .gitignore .env.example src/app/globals.css src/app/layout.tsx src/app/page.tsx tests/app/home.test.tsx
git commit -m "feat: scaffold Next.js + Tailwind + Vitest project"
```

---

### Task 2: Database schema & Prisma client

> **Setup requirement before this task (updated a second time, during Task 2 execution):** local PostgreSQL 17 was installed via `winget`, but resetting its auto-generated superuser password requires an admin-rights service restart that this machine's working shell doesn't have, and elevated commands/Windows security changes are off the table per explicit instruction. **Development uses Prisma's `sqlite` connector instead** — a single local file, `prisma/dev.db`, no server/service/admin rights needed at all. `DATABASE_URL="file:./dev.db"`. Postgres is introduced later, at actual deployment time — see the spec's "SQLite ↔ Postgres portability" section for exactly what that cutover involves (it is a real migration event, not a pure connection-string swap, because the two connectors' migration histories aren't interchangeable). The local PostgreSQL install from the first attempt is left in place, untouched, in case this decision is reversed.

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/db/prisma.ts`
- Test: `tests/lib/db/prisma.test.ts`

**Interfaces:**
- Produces: `prisma` (singleton `PrismaClient` instance) from `@/lib/db/prisma`, imported by every later task that touches the database.

- [ ] **Step 1: Write the schema**

`prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id             String    @id @default(cuid())
  email          String    @unique
  passwordHash   String
  emailVerified  DateTime?
  sessionVersion Int       @default(0)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  accounts           Account[]
  verificationTokens VerificationToken[]
  studentProfile     StudentProfile?
}

// Required by @auth/prisma-adapter's PrismaAdapter type, even though the
// Credentials provider never creates rows here (no OAuth account to link).
// No @db.Text on the token columns: SQLite's connector doesn't support it,
// and Postgres already maps plain String to text by default, so dropping
// it costs nothing there and keeps this schema portable across both.
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

// App-specific single-use tokens (email verification, password reset).
// NOT the NextAuth "magic link" VerificationToken shape — we don't use that flow.
model VerificationToken {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  purpose   String // "email_verify" | "password_reset"
  expiresAt DateTime
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model StudentProfile {
  id                    String    @id @default(cuid())
  userId                String    @unique
  name                  String
  dateOfBirth           DateTime
  grade                 String
  schoolName            String
  curriculum            String
  academicYear          String
  gender                String? // null = "prefer not to say"
  timezone              String
  onboardingCompletedAt DateTime?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  user                User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  guardian            Guardian?
  subjects            Subject[]
  timetableEntries    TimetableEntry[]
  availabilityWindows AvailabilityWindow[]
  goals               Goal[]
  reminderPreference  ReminderPreference?
}

model Guardian {
  id                 String    @id @default(cuid())
  studentProfileId   String    @unique
  name               String
  email              String
  consentToken       String    @unique
  consentRequestedAt DateTime  @default(now())
  consentGivenAt     DateTime?

  studentProfile StudentProfile @relation(fields: [studentProfileId], references: [id], onDelete: Cascade)
}

model Subject {
  id               String @id @default(cuid())
  studentProfileId String
  name             String
  order            Int    @default(0)

  studentProfile   StudentProfile   @relation(fields: [studentProfileId], references: [id], onDelete: Cascade)
  timetableEntries TimetableEntry[]
  goals            Goal[]
}

model TimetableEntry {
  id               String  @id @default(cuid())
  studentProfileId String
  dayOfWeek        Int // 0=Sunday .. 6=Saturday
  subjectId        String?
  startTime        String // "HH:mm"
  endTime          String // "HH:mm"

  studentProfile StudentProfile @relation(fields: [studentProfileId], references: [id], onDelete: Cascade)
  subject        Subject?       @relation(fields: [subjectId], references: [id], onDelete: SetNull)
}

model AvailabilityWindow {
  id               String @id @default(cuid())
  studentProfileId String
  dayOfWeek        Int
  startTime        String
  endTime          String

  studentProfile StudentProfile @relation(fields: [studentProfileId], references: [id], onDelete: Cascade)
}

model Goal {
  id               String    @id @default(cuid())
  studentProfileId String
  subjectId        String?
  description      String
  examDate         DateTime?

  studentProfile StudentProfile @relation(fields: [studentProfileId], references: [id], onDelete: Cascade)
  subject        Subject?       @relation(fields: [subjectId], references: [id], onDelete: SetNull)
}

model ReminderPreference {
  id               String   @id @default(cuid())
  studentProfileId String   @unique
  channel          String // "browser" | "email" | "whatsapp" | "none"
  preferredTimes   String // JSON-encoded string[] of "HH:mm" — SQLite has no array type; see spec's portability note
  phone            String?

  studentProfile StudentProfile @relation(fields: [studentProfileId], references: [id], onDelete: Cascade)
}

model RateLimitAttempt {
  id         String   @id @default(cuid())
  action     String
  identifier String
  createdAt  DateTime @default(now())

  @@index([action, identifier, createdAt])
}
```

- [ ] **Step 2: Run the migration**

Run: `npx prisma migrate dev --name init`
Expected: creates `prisma/dev.db` (a new SQLite file) and `prisma/migrations/`, generates the Prisma client. No server, service, or network connection is involved.

- [ ] **Step 3: Write the failing test**

`tests/lib/db/prisma.test.ts`:
```typescript
import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";

describe("prisma client", () => {
  const testEmail = `prisma-smoke-${Date.now()}@example.test`;

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: testEmail } });
    await prisma.$disconnect();
  });

  it("can create and read a user row", async () => {
    const created = await prisma.user.create({
      data: { email: testEmail, passwordHash: "test-hash" },
    });

    const found = await prisma.user.findUnique({ where: { id: created.id } });

    expect(found?.email).toBe(testEmail);
  });
});
```

- [ ] **Step 4: Run the test and verify it fails**

Run: `npx vitest run tests/lib/db/prisma.test.ts`
Expected: FAIL — `Cannot find module '@/lib/db/prisma'`.

- [ ] **Step 5: Create the Prisma client singleton**

`src/lib/db/prisma.ts`:
```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 6: Run the test and verify it passes**

Run: `npx vitest run tests/lib/db/prisma.test.ts`
Expected: PASS (confirms `DATABASE_URL` is reachable and the schema is applied).

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/db/prisma.ts tests/lib/db/prisma.test.ts
git commit -m "feat: add Prisma schema and database client"
```

---

### Task 3: Core validation utilities

**Files:**
- Create: `src/lib/validation/password.ts`
- Create: `src/lib/validation/age.ts`
- Create: `src/lib/validation/timetable.ts`
- Create: `src/lib/validation/tokens.ts`
- Test: `tests/lib/validation/password.test.ts`
- Test: `tests/lib/validation/age.test.ts`
- Test: `tests/lib/validation/timetable.test.ts`
- Test: `tests/lib/validation/tokens.test.ts`

**Interfaces:**
- Produces: `validatePassword(password: string): { valid: boolean; reason?: string }`
- Produces: `calculateAge(dob: Date, asOf?: Date): number`, `requiresGuardianConsent(dob: Date, asOf?: Date): boolean`
- Produces: `hasOverlap(entries: TimeRange[]): boolean` where `TimeRange = { dayOfWeek: number; startTime: string; endTime: string }`
- Produces: `generateToken(): string`, `isTokenExpired(expiresAt: Date, asOf?: Date): boolean`, `tokenExpiryDate(hoursFromNow: number, asOf?: Date): Date`

- [ ] **Step 1: Write failing password tests**

`tests/lib/validation/password.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { validatePassword } from "@/lib/validation/password";

describe("validatePassword", () => {
  it("rejects passwords shorter than 10 characters", () => {
    expect(validatePassword("short1").valid).toBe(false);
  });

  it("accepts a password exactly 10 characters long", () => {
    expect(validatePassword("abcdefghij").valid).toBe(true);
  });

  it("rejects common passwords", () => {
    expect(validatePassword("password1").valid).toBe(false);
  });

  it("accepts a strong password", () => {
    expect(validatePassword("Tr0ub4dor&3xtra").valid).toBe(true);
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npx vitest run tests/lib/validation/password.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/validation/password.ts`:
```typescript
const COMMON_PASSWORDS = new Set([
  "password1",
  "12345678910",
  "qwertyuiop",
  "letmein123",
  "iloveyou12",
]);

export function validatePassword(password: string): { valid: boolean; reason?: string } {
  if (password.length < 10) {
    return { valid: false, reason: "Password must be at least 10 characters long." };
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return { valid: false, reason: "This password is too common. Please choose a different one." };
  }
  return { valid: true };
}
```

- [ ] **Step 4: Run and verify pass**

Run: `npx vitest run tests/lib/validation/password.test.ts`
Expected: PASS

- [ ] **Step 5: Write failing age tests**

`tests/lib/validation/age.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { calculateAge, requiresGuardianConsent } from "@/lib/validation/age";

describe("age calculations", () => {
  it("calculates age correctly before a birthday has passed this year", () => {
    expect(calculateAge(new Date("2010-12-25"), new Date("2026-10-14"))).toBe(15);
  });

  it("calculates age correctly on the birthday itself", () => {
    expect(calculateAge(new Date("2008-10-14"), new Date("2026-10-14"))).toBe(18);
  });

  it("does not require guardian consent for a student turning exactly 18 today", () => {
    expect(requiresGuardianConsent(new Date("2008-10-14"), new Date("2026-10-14"))).toBe(false);
  });

  it("requires guardian consent for a student turning 18 tomorrow", () => {
    expect(requiresGuardianConsent(new Date("2008-10-15"), new Date("2026-10-14"))).toBe(true);
  });
});
```

- [ ] **Step 6: Run and verify failure**

Run: `npx vitest run tests/lib/validation/age.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement**

`src/lib/validation/age.ts`:
```typescript
export function calculateAge(dateOfBirth: Date, asOf: Date = new Date()): number {
  let age = asOf.getFullYear() - dateOfBirth.getFullYear();
  const hasHadBirthdayThisYear =
    asOf.getMonth() > dateOfBirth.getMonth() ||
    (asOf.getMonth() === dateOfBirth.getMonth() && asOf.getDate() >= dateOfBirth.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

export function requiresGuardianConsent(dateOfBirth: Date, asOf: Date = new Date()): boolean {
  return calculateAge(dateOfBirth, asOf) < 18;
}
```

- [ ] **Step 8: Run and verify pass**

Run: `npx vitest run tests/lib/validation/age.test.ts`
Expected: PASS

- [ ] **Step 9: Write failing timetable tests**

`tests/lib/validation/timetable.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { hasOverlap } from "@/lib/validation/timetable";

describe("hasOverlap", () => {
  it("returns false for entries on different days at the same time", () => {
    expect(
      hasOverlap([
        { dayOfWeek: 1, startTime: "09:00", endTime: "10:00" },
        { dayOfWeek: 2, startTime: "09:00", endTime: "10:00" },
      ]),
    ).toBe(false);
  });

  it("returns false for back-to-back entries on the same day", () => {
    expect(
      hasOverlap([
        { dayOfWeek: 1, startTime: "09:00", endTime: "10:00" },
        { dayOfWeek: 1, startTime: "10:00", endTime: "11:00" },
      ]),
    ).toBe(false);
  });

  it("returns true for a partial overlap on the same day", () => {
    expect(
      hasOverlap([
        { dayOfWeek: 1, startTime: "09:00", endTime: "10:30" },
        { dayOfWeek: 1, startTime: "10:00", endTime: "11:00" },
      ]),
    ).toBe(true);
  });

  it("returns true for fully contained overlapping entries", () => {
    expect(
      hasOverlap([
        { dayOfWeek: 1, startTime: "09:00", endTime: "12:00" },
        { dayOfWeek: 1, startTime: "10:00", endTime: "11:00" },
      ]),
    ).toBe(true);
  });
});
```

- [ ] **Step 10: Run and verify failure**

Run: `npx vitest run tests/lib/validation/timetable.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 11: Implement**

`src/lib/validation/timetable.ts`:
```typescript
export interface TimeRange {
  dayOfWeek: number;
  startTime: string; // "HH:mm"
  endTime: string;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function hasOverlap(entries: TimeRange[]): boolean {
  const byDay = new Map<number, TimeRange[]>();
  for (const entry of entries) {
    const list = byDay.get(entry.dayOfWeek) ?? [];
    list.push(entry);
    byDay.set(entry.dayOfWeek, list);
  }

  for (const dayEntries of byDay.values()) {
    const sorted = [...dayEntries].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
    for (let i = 1; i < sorted.length; i++) {
      if (toMinutes(sorted[i].startTime) < toMinutes(sorted[i - 1].endTime)) {
        return true;
      }
    }
  }
  return false;
}
```

- [ ] **Step 12: Run and verify pass**

Run: `npx vitest run tests/lib/validation/timetable.test.ts`
Expected: PASS

- [ ] **Step 13: Write failing token tests**

`tests/lib/validation/tokens.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { generateToken, isTokenExpired, tokenExpiryDate } from "@/lib/validation/tokens";

describe("token utilities", () => {
  it("generates a 64-character hex token", () => {
    const token = generateToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates unique tokens across calls", () => {
    expect(generateToken()).not.toBe(generateToken());
  });

  it("treats a token as expired exactly at its expiry instant", () => {
    const expiresAt = new Date("2026-10-14T10:00:00Z");
    expect(isTokenExpired(expiresAt, new Date("2026-10-14T10:00:00Z"))).toBe(true);
  });

  it("treats a token as not expired one millisecond before expiry", () => {
    const expiresAt = new Date("2026-10-14T10:00:00.001Z");
    expect(isTokenExpired(expiresAt, new Date("2026-10-14T10:00:00.000Z"))).toBe(false);
  });

  it("computes an expiry date N hours from now", () => {
    const asOf = new Date("2026-10-14T10:00:00Z");
    expect(tokenExpiryDate(24, asOf).toISOString()).toBe("2026-10-15T10:00:00.000Z");
  });
});
```

- [ ] **Step 14: Run and verify failure**

Run: `npx vitest run tests/lib/validation/tokens.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 15: Implement**

`src/lib/validation/tokens.ts`:
```typescript
import { randomBytes } from "crypto";

export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export function isTokenExpired(expiresAt: Date, asOf: Date = new Date()): boolean {
  return asOf.getTime() >= expiresAt.getTime();
}

export function tokenExpiryDate(hoursFromNow: number, asOf: Date = new Date()): Date {
  return new Date(asOf.getTime() + hoursFromNow * 60 * 60 * 1000);
}
```

- [ ] **Step 16: Run and verify pass**

Run: `npx vitest run tests/lib/validation/tokens.test.ts`
Expected: PASS

- [ ] **Step 17: Commit**

```bash
git add src/lib/validation tests/lib/validation
git commit -m "feat: add password, age, timetable, and token validation utilities"
```

---

### Task 4: Email sending abstraction + dev inbox

**Files:**
- Create: `src/lib/email/devStore.ts`
- Create: `src/lib/email/send.ts`
- Create: `src/app/dev/emails/page.tsx`
- Test: `tests/lib/email/devStore.test.ts`
- Test: `tests/lib/email/send.test.ts`

**Interfaces:**
- Consumes: none (first email-layer task).
- Produces: `sendEmail({ to, subject, body }): Promise<{ delivered: boolean }>` from `@/lib/email/send`, used by Tasks 5, 7, 8.
- Produces: `getDevEmails(): DevEmail[]` from `@/lib/email/devStore`.

- [ ] **Step 1: Write failing devStore test**

`tests/lib/email/devStore.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { recordDevEmail, getDevEmails, clearDevEmails } from "@/lib/email/devStore";

describe("devStore", () => {
  beforeEach(() => clearDevEmails());

  it("records and retrieves emails, most recent first", () => {
    recordDevEmail({ to: "a@example.test", subject: "First", body: "..." });
    recordDevEmail({ to: "b@example.test", subject: "Second", body: "..." });

    const emails = getDevEmails();
    expect(emails).toHaveLength(2);
    expect(emails[0].subject).toBe("Second");
  });

  it("caps stored emails at 50", () => {
    for (let i = 0; i < 55; i++) {
      recordDevEmail({ to: "a@example.test", subject: `#${i}`, body: "..." });
    }
    expect(getDevEmails()).toHaveLength(50);
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npx vitest run tests/lib/email/devStore.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement devStore**

`src/lib/email/devStore.ts`:
```typescript
export interface DevEmail {
  to: string;
  subject: string;
  body: string;
  sentAt: Date;
}

const store: DevEmail[] = [];

export function recordDevEmail(email: Omit<DevEmail, "sentAt">): void {
  store.unshift({ ...email, sentAt: new Date() });
  if (store.length > 50) store.pop();
}

export function getDevEmails(): DevEmail[] {
  return store;
}

export function clearDevEmails(): void {
  store.length = 0;
}
```

- [ ] **Step 4: Run and verify pass**

Run: `npx vitest run tests/lib/email/devStore.test.ts`
Expected: PASS

- [ ] **Step 5: Write failing send test**

`tests/lib/email/send.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { clearDevEmails, getDevEmails } from "@/lib/email/devStore";

describe("sendEmail", () => {
  beforeEach(() => {
    clearDevEmails();
    vi.resetModules();
    delete process.env.RESEND_API_KEY;
  });

  it("records to the dev inbox instead of sending when RESEND_API_KEY is unset", async () => {
    const { sendEmail } = await import("@/lib/email/send");
    const result = await sendEmail({ to: "student@example.test", subject: "Hi", body: "Body" });

    expect(result.delivered).toBe(false);
    expect(getDevEmails()).toHaveLength(1);
    expect(getDevEmails()[0].to).toBe("student@example.test");
  });
});
```

- [ ] **Step 6: Run and verify failure**

Run: `npx vitest run tests/lib/email/send.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement send**

`src/lib/email/send.ts`:
```typescript
import { Resend } from "resend";
import { recordDevEmail } from "./devStore";

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
}

export async function sendEmail({ to, subject, body }: SendEmailInput): Promise<{ delivered: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    recordDevEmail({ to, subject, body });
    console.log(`[dev email] to=${to} subject="${subject}"\n${body}`);
    return { delivered: false };
  }

  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM_EMAIL ?? "Study Reminder <onboarding@resend.dev>";
  await resend.emails.send({ from, to, subject, text: body });
  return { delivered: true };
}
```

- [ ] **Step 8: Run and verify pass**

Run: `npx vitest run tests/lib/email/send.test.ts`
Expected: PASS

- [ ] **Step 9: Build the dev inbox page**

`src/app/dev/emails/page.tsx`:
```tsx
import { getDevEmails } from "@/lib/email/devStore";

export default function DevEmailsPage() {
  if (process.env.RESEND_API_KEY) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-slate-600">
          A real email provider is configured, so emails are actually sent and this dev inbox is not used.
        </p>
      </main>
    );
  }

  const emails = getDevEmails();

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mb-6 text-2xl font-semibold text-pink-dark">Dev email inbox</h1>
      <p className="mb-6 text-sm text-slate-500">
        No email provider is configured, so verification/reset/consent emails appear here instead of being sent.
      </p>
      {emails.length === 0 ? (
        <p className="text-slate-500">No emails yet.</p>
      ) : (
        <ul className="space-y-4">
          {emails.map((email, i) => (
            <li key={i} className="rounded-xl bg-blush p-4">
              <p className="text-sm text-slate-500">
                To: {email.to} · {email.sentAt.toLocaleString()}
              </p>
              <p className="font-medium">{email.subject}</p>
              <pre className="mt-2 whitespace-pre-wrap text-sm">{email.body}</pre>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 10: Commit**

```bash
git add src/lib/email src/app/dev tests/lib/email
git commit -m "feat: add email sending abstraction with dev inbox fallback"
```

---

### Task 5: Auth.js configuration, credential verification & revocable sessions

> **Decision:** Auth.js disallows true database sessions with the Credentials provider, so this task uses JWT sessions plus a DB-checked `sessionVersion` on `User` (added in Task 2). Any protected page/action must read the session through `getCurrentSessionUser()` below, not the raw `auth()` call, so a revoked session is actually rejected.

**Files:**
- Create: `src/lib/auth/verifyCredentials.ts`
- Create: `src/lib/auth/session.ts`
- Create: `src/lib/auth/revokeSessions.ts`
- Create: `src/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Test: `tests/lib/auth/verifyCredentials.test.ts`
- Test: `tests/lib/auth/session.test.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/db/prisma` (Task 2).
- Produces: `verifyCredentials(email: string, password: string): Promise<{ id: string; email: string } | null>`
- Produces: `getCurrentSessionUser(): Promise<{ id: string; email: string; emailVerified: Date | null } | null>`
- Produces: `revokeAllSessions(userId: string): Promise<void>` — used by Task 7 after a password reset.
- Produces: `auth`, `signIn`, `signOut`, `handlers` from `@/auth`, used by Tasks 6 and 7's login UI.

- [ ] **Step 1: Write failing verifyCredentials tests**

`tests/lib/auth/verifyCredentials.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));

import { prisma } from "@/lib/db/prisma";
import { verifyCredentials } from "@/lib/auth/verifyCredentials";
import bcrypt from "bcryptjs";

describe("verifyCredentials", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null for an unknown email", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    expect(await verifyCredentials("nobody@example.test", "whatever123")).toBeNull();
  });

  it("returns null for an unverified user, even with the correct password", async () => {
    const hash = await bcrypt.hash("correct-horse-1", 12);
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "u1",
      email: "student@example.test",
      passwordHash: hash,
      emailVerified: null,
    });
    expect(await verifyCredentials("student@example.test", "correct-horse-1")).toBeNull();
  });

  it("returns null for a wrong password", async () => {
    const hash = await bcrypt.hash("correct-horse-1", 12);
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "u1",
      email: "student@example.test",
      passwordHash: hash,
      emailVerified: new Date(),
    });
    expect(await verifyCredentials("student@example.test", "wrong-password")).toBeNull();
  });

  it("returns the user for correct credentials on a verified account", async () => {
    const hash = await bcrypt.hash("correct-horse-1", 12);
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "u1",
      email: "student@example.test",
      passwordHash: hash,
      emailVerified: new Date(),
    });
    expect(await verifyCredentials("student@example.test", "correct-horse-1")).toEqual({
      id: "u1",
      email: "student@example.test",
    });
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npx vitest run tests/lib/auth/verifyCredentials.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/auth/verifyCredentials.ts`:
```typescript
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";

export async function verifyCredentials(
  email: string,
  password: string,
): Promise<{ id: string; email: string } | null> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.emailVerified) return null;

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  return { id: user.id, email: user.email };
}
```

- [ ] **Step 4: Run and verify pass**

Run: `npx vitest run tests/lib/auth/verifyCredentials.test.ts`
Expected: PASS

- [ ] **Step 5: Write failing session tests**

`tests/lib/auth/session.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSessionUser } from "@/lib/auth/session";

describe("getCurrentSessionUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when there is no session", async () => {
    (auth as any).mockResolvedValue(null);
    expect(await getCurrentSessionUser()).toBeNull();
  });

  it("returns null when the session's sessionVersion no longer matches the database (revoked)", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", email: "s@example.test", sessionVersion: 1 } });
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "u1",
      email: "s@example.test",
      emailVerified: new Date(),
      sessionVersion: 2,
    });
    expect(await getCurrentSessionUser()).toBeNull();
  });

  it("returns the user when the session version matches", async () => {
    (auth as any).mockResolvedValue({ user: { id: "u1", email: "s@example.test", sessionVersion: 1 } });
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "u1",
      email: "s@example.test",
      emailVerified: new Date("2026-01-01"),
      sessionVersion: 1,
    });
    expect(await getCurrentSessionUser()).toEqual({
      id: "u1",
      email: "s@example.test",
      emailVerified: new Date("2026-01-01"),
    });
  });
});
```

- [ ] **Step 6: Run and verify failure**

Run: `npx vitest run tests/lib/auth/session.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 7: Implement `src/auth.ts`**

```typescript
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verifyCredentials } from "@/lib/auth/verifyCredentials";
import { prisma } from "@/lib/db/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "credentials",
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;
        return verifyCredentials(email, password);
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
        token.sessionVersion = dbUser?.sessionVersion ?? 0;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.sessionVersion = token.sessionVersion as number;
      }
      return session;
    },
  },
});
```

- [ ] **Step 8: Implement the session helper**

`src/lib/auth/session.ts`:
```typescript
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

export interface SessionUser {
  id: string;
  email: string;
  emailVerified: Date | null;
}

export async function getCurrentSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user) return null;

  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!dbUser) return null;
  if (dbUser.sessionVersion !== session.user.sessionVersion) return null;

  return { id: dbUser.id, email: dbUser.email, emailVerified: dbUser.emailVerified };
}
```

- [ ] **Step 9: Implement the revocation helper**

`src/lib/auth/revokeSessions.ts`:
```typescript
import { prisma } from "@/lib/db/prisma";

export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
  });
}
```

- [ ] **Step 10: Add the NextAuth route handler**

`src/app/api/auth/[...nextauth]/route.ts`:
```typescript
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 11: Run and verify pass**

Run: `npx vitest run tests/lib/auth/verifyCredentials.test.ts tests/lib/auth/session.test.ts`
Expected: PASS

- [ ] **Step 12: Add `AUTH_SECRET` requirement note**

Verify `.env` (local, not committed) has `AUTH_SECRET` set to a long random string — generate one with `openssl rand -base64 32` or any password generator. Auth.js reads this automatically.

- [ ] **Step 13: Commit**

```bash
git add src/auth.ts src/app/api/auth src/lib/auth/verifyCredentials.ts src/lib/auth/session.ts src/lib/auth/revokeSessions.ts tests/lib/auth
git commit -m "feat: configure Auth.js with revocable JWT sessions"
```

---

### Task 6: Signup, verify-email & welcome-page polish

**Files:**
- Create: `src/lib/auth/signup.ts`
- Create: `src/lib/auth/verifyEmail.ts`
- Create: `src/app/signup/page.tsx`
- Create: `src/app/verify-email/page.tsx`
- Test: `tests/lib/auth/signup.test.ts`
- Test: `tests/lib/auth/verifyEmail.test.ts`

**Interfaces:**
- Consumes: `validatePassword` (Task 3), `generateToken`/`tokenExpiryDate`/`isTokenExpired` (Task 3), `sendEmail` (Task 4), `prisma` (Task 2).
- Produces: `signupStudent(input: { email: string; password: string }): Promise<{ success: boolean; error?: string }>`
- Produces: `verifyEmailToken(token: string): Promise<{ success: boolean; error?: string }>`

- [ ] **Step 1: Write failing signup tests**

`tests/lib/auth/signup.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn() },
    verificationToken: { create: vi.fn() },
  },
}));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn() }));

import { prisma } from "@/lib/db/prisma";
import { sendEmail } from "@/lib/email/send";
import { signupStudent } from "@/lib/auth/signup";

describe("signupStudent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a weak password without touching the database", async () => {
    const result = await signupStudent({ email: "a@example.test", password: "short" });
    expect(result.success).toBe(false);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("rejects an email that already has an account", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "existing" });
    const result = await signupStudent({ email: "a@example.test", password: "longenoughpassword1" });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already exists/i);
  });

  it("creates a user, a verification token, and sends the verification email", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    (prisma.user.create as any).mockResolvedValue({ id: "u1", email: "a@example.test" });

    const result = await signupStudent({ email: "a@example.test", password: "longenoughpassword1" });

    expect(result.success).toBe(true);
    expect(prisma.verificationToken.create).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "a@example.test", subject: expect.stringMatching(/verify/i) }),
    );
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npx vitest run tests/lib/auth/signup.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/auth/signup.ts`:
```typescript
"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { validatePassword } from "@/lib/validation/password";
import { generateToken, tokenExpiryDate } from "@/lib/validation/tokens";
import { sendEmail } from "@/lib/email/send";

export interface SignupInput {
  email: string;
  password: string;
}

export interface SignupResult {
  success: boolean;
  error?: string;
}

export async function signupStudent({ email, password }: SignupInput): Promise<SignupResult> {
  const passwordCheck = validatePassword(password);
  if (!passwordCheck.valid) {
    return { success: false, error: passwordCheck.reason };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { success: false, error: "An account with this email already exists." };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({ data: { email, passwordHash } });

  const token = generateToken();
  await prisma.verificationToken.create({
    data: { token, userId: user.id, purpose: "email_verify", expiresAt: tokenExpiryDate(24) },
  });

  await sendEmail({
    to: email,
    subject: "Verify your Study Reminder account",
    body: `Welcome to Study Reminder! Verify your email here: ${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=${token}`,
  });

  return { success: true };
}
```

- [ ] **Step 4: Run and verify pass**

Run: `npx vitest run tests/lib/auth/signup.test.ts`
Expected: PASS

- [ ] **Step 5: Write failing verifyEmail tests**

`tests/lib/auth/verifyEmail.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    verificationToken: { findUnique: vi.fn(), delete: vi.fn() },
    user: { update: vi.fn() },
  },
}));

import { prisma } from "@/lib/db/prisma";
import { verifyEmailToken } from "@/lib/auth/verifyEmail";

describe("verifyEmailToken", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects an unknown token", async () => {
    (prisma.verificationToken.findUnique as any).mockResolvedValue(null);
    const result = await verifyEmailToken("nonexistent");
    expect(result.success).toBe(false);
  });

  it("rejects and deletes an expired token without verifying the user", async () => {
    (prisma.verificationToken.findUnique as any).mockResolvedValue({
      token: "t1",
      userId: "u1",
      purpose: "email_verify",
      expiresAt: new Date(Date.now() - 1000),
    });
    const result = await verifyEmailToken("t1");
    expect(result.success).toBe(false);
    expect(prisma.verificationToken.delete).toHaveBeenCalledWith({ where: { token: "t1" } });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("verifies the user and deletes a valid token", async () => {
    (prisma.verificationToken.findUnique as any).mockResolvedValue({
      token: "t1",
      userId: "u1",
      purpose: "email_verify",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    });
    const result = await verifyEmailToken("t1");
    expect(result.success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { emailVerified: expect.any(Date) },
    });
    expect(prisma.verificationToken.delete).toHaveBeenCalledWith({ where: { token: "t1" } });
  });
});
```

- [ ] **Step 6: Run and verify failure**

Run: `npx vitest run tests/lib/auth/verifyEmail.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement**

`src/lib/auth/verifyEmail.ts`:
```typescript
"use server";

import { prisma } from "@/lib/db/prisma";
import { isTokenExpired } from "@/lib/validation/tokens";

export async function verifyEmailToken(token: string): Promise<{ success: boolean; error?: string }> {
  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record || record.purpose !== "email_verify") {
    return { success: false, error: "This verification link is invalid." };
  }

  if (isTokenExpired(record.expiresAt)) {
    await prisma.verificationToken.delete({ where: { token } });
    return { success: false, error: "This verification link has expired. Please request a new one." };
  }

  await prisma.user.update({ where: { id: record.userId }, data: { emailVerified: new Date() } });
  await prisma.verificationToken.delete({ where: { token } });
  return { success: true };
}
```

- [ ] **Step 8: Run and verify pass**

Run: `npx vitest run tests/lib/auth/verifyEmail.test.ts`
Expected: PASS

- [ ] **Step 9: Build the signup page**

`src/app/signup/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { signupStudent } from "@/lib/auth/signup";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setStatus("submitting");
    const result = await signupStudent({ email, password });
    if (result.success) {
      setStatus("success");
    } else {
      setStatus("error");
      setError(result.error ?? "Something went wrong. Please try again.");
    }
  }

  if (status === "success") {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="mb-4 text-2xl font-semibold text-pink-dark">Check your email</h1>
        <p className="text-slate-600">
          We&apos;ve sent a verification link to <strong>{email}</strong>. Click it to activate your account.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-24">
      <h1 className="mb-8 text-2xl font-semibold text-pink-dark">Create your account</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-700">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-lavender px-4 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-700">Password</span>
          <input
            type="password"
            required
            minLength={10}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-lavender px-4 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-700">Confirm password</span>
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="rounded-lg border border-lavender px-4 py-2"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={status === "submitting"}
          className="mt-2 rounded-full bg-pink px-6 py-3 font-medium text-white hover:bg-pink-dark disabled:opacity-60"
        >
          {status === "submitting" ? "Creating account..." : "Sign up"}
        </button>
      </form>
      <p className="mt-6 text-sm text-slate-500">
        Already have an account? <Link href="/login" className="text-lavender-dark underline">Log in</Link>
      </p>
    </main>
  );
}
```

- [ ] **Step 10: Build the verify-email page**

`src/app/verify-email/page.tsx`:
```tsx
import Link from "next/link";
import { verifyEmailToken } from "@/lib/auth/verifyEmail";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <p className="text-slate-600">Check your email for a verification link to activate your account.</p>
      </main>
    );
  }

  const result = await verifyEmailToken(token);

  return (
    <main className="mx-auto max-w-md px-6 py-24 text-center">
      {result.success ? (
        <>
          <h1 className="mb-4 text-2xl font-semibold text-pink-dark">Email verified!</h1>
          <Link href="/login" className="text-lavender-dark underline">
            Log in to continue
          </Link>
        </>
      ) : (
        <>
          <h1 className="mb-4 text-2xl font-semibold text-pink-dark">Verification failed</h1>
          <p className="text-slate-600">{result.error}</p>
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 11: Commit**

```bash
git add src/lib/auth/signup.ts src/lib/auth/verifyEmail.ts src/app/signup src/app/verify-email tests/lib/auth/signup.test.ts tests/lib/auth/verifyEmail.test.ts
git commit -m "feat: add signup and email verification flow"
```

---

### Task 7: Login, forgot/reset password

**Files:**
- Create: `src/lib/auth/passwordReset.ts`
- Create: `src/app/login/page.tsx`
- Create: `src/app/forgot-password/page.tsx`
- Create: `src/app/reset-password/page.tsx`
- Test: `tests/lib/auth/passwordReset.test.ts`

**Interfaces:**
- Consumes: `validatePassword`, `generateToken`, `tokenExpiryDate`, `isTokenExpired` (Task 3), `sendEmail` (Task 4), `revokeAllSessions` (Task 5), `signIn` (Task 5).
- Produces: `requestPasswordReset(email: string): Promise<{ success: boolean }>`, `resetPassword(token: string, newPassword: string): Promise<{ success: boolean; error?: string }>`

- [ ] **Step 1: Write failing passwordReset tests**

`tests/lib/auth/passwordReset.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    verificationToken: { create: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
  },
}));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/auth/revokeSessions", () => ({ revokeAllSessions: vi.fn() }));

import { prisma } from "@/lib/db/prisma";
import { sendEmail } from "@/lib/email/send";
import { revokeAllSessions } from "@/lib/auth/revokeSessions";
import { requestPasswordReset, resetPassword } from "@/lib/auth/passwordReset";

describe("requestPasswordReset", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reports success without sending an email for an unknown address, to avoid leaking account existence", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    const result = await requestPasswordReset("nobody@example.test");
    expect(result.success).toBe(true);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends a reset email for a known address", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "u1", email: "a@example.test" });
    await requestPasswordReset("a@example.test");
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "a@example.test" }));
  });
});

describe("resetPassword", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects an expired or invalid token", async () => {
    (prisma.verificationToken.findUnique as any).mockResolvedValue(null);
    const result = await resetPassword("bad-token", "longenoughpassword1");
    expect(result.success).toBe(false);
  });

  it("rejects a weak new password", async () => {
    (prisma.verificationToken.findUnique as any).mockResolvedValue({
      token: "t1",
      userId: "u1",
      purpose: "password_reset",
      expiresAt: new Date(Date.now() + 10000),
    });
    const result = await resetPassword("t1", "short");
    expect(result.success).toBe(false);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("updates the password hash and revokes existing sessions on success", async () => {
    (prisma.verificationToken.findUnique as any).mockResolvedValue({
      token: "t1",
      userId: "u1",
      purpose: "password_reset",
      expiresAt: new Date(Date.now() + 10000),
    });
    const result = await resetPassword("t1", "longenoughpassword1");
    expect(result.success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalled();
    expect(revokeAllSessions).toHaveBeenCalledWith("u1");
    expect(prisma.verificationToken.delete).toHaveBeenCalledWith({ where: { token: "t1" } });
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npx vitest run tests/lib/auth/passwordReset.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/auth/passwordReset.ts`:
```typescript
"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { validatePassword } from "@/lib/validation/password";
import { generateToken, tokenExpiryDate, isTokenExpired } from "@/lib/validation/tokens";
import { sendEmail } from "@/lib/email/send";
import { revokeAllSessions } from "@/lib/auth/revokeSessions";

export async function requestPasswordReset(email: string): Promise<{ success: boolean }> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const token = generateToken();
    await prisma.verificationToken.create({
      data: { token, userId: user.id, purpose: "password_reset", expiresAt: tokenExpiryDate(1) },
    });
    await sendEmail({
      to: email,
      subject: "Reset your Study Reminder password",
      body: `Reset your password here: ${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`,
    });
  }
  return { success: true };
}

export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record || record.purpose !== "password_reset" || isTokenExpired(record.expiresAt)) {
    if (record) await prisma.verificationToken.delete({ where: { token } });
    return { success: false, error: "This reset link is invalid or has expired." };
  }

  const passwordCheck = validatePassword(newPassword);
  if (!passwordCheck.valid) {
    return { success: false, error: passwordCheck.reason };
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: record.userId }, data: { passwordHash } });
  await revokeAllSessions(record.userId);
  await prisma.verificationToken.delete({ where: { token } });
  return { success: true };
}
```

- [ ] **Step 4: Run and verify pass**

Run: `npx vitest run tests/lib/auth/passwordReset.test.ts`
Expected: PASS

- [ ] **Step 5: Build the login page**

`src/app/login/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await signIn("credentials", { email, password, redirect: false });

    if (result?.error) {
      setError("Invalid email or password, or your email isn't verified yet.");
      setSubmitting(false);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <main className="mx-auto max-w-md px-6 py-24">
      <h1 className="mb-8 text-2xl font-semibold text-pink-dark">Log in</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-700">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-lavender px-4 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-700">Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-lavender px-4 py-2"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded-full bg-pink px-6 py-3 font-medium text-white hover:bg-pink-dark disabled:opacity-60"
        >
          {submitting ? "Logging in..." : "Log in"}
        </button>
      </form>
      <p className="mt-6 text-sm text-slate-500">
        <Link href="/forgot-password" className="text-lavender-dark underline">Forgot your password?</Link>
      </p>
    </main>
  );
}
```

- [ ] **Step 6: Build the forgot-password page**

`src/app/forgot-password/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { requestPasswordReset } from "@/lib/auth/passwordReset";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await requestPasswordReset(email);
    setSent(true);
  }

  if (sent) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <p className="text-slate-600">
          If an account exists for <strong>{email}</strong>, we&apos;ve sent a password reset link.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-24">
      <h1 className="mb-8 text-2xl font-semibold text-pink-dark">Reset your password</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-700">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-lavender px-4 py-2"
          />
        </label>
        <button
          type="submit"
          className="mt-2 rounded-full bg-pink px-6 py-3 font-medium text-white hover:bg-pink-dark"
        >
          Send reset link
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 7: Build the reset-password page**

`src/app/reset-password/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { resetPassword } from "@/lib/auth/passwordReset";

export default function ResetPasswordPage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = await resetPassword(token, password);
    if (result.success) {
      setSuccess(true);
      setTimeout(() => router.push("/login"), 1500);
    } else {
      setError(result.error ?? "Something went wrong.");
    }
  }

  if (success) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <p className="text-slate-600">Password updated. Redirecting to login...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-24">
      <h1 className="mb-8 text-2xl font-semibold text-pink-dark">Choose a new password</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-700">New password</span>
          <input
            type="password"
            required
            minLength={10}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-lavender px-4 py-2"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          className="mt-2 rounded-full bg-pink px-6 py-3 font-medium text-white hover:bg-pink-dark"
        >
          Update password
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/auth/passwordReset.ts src/app/login src/app/forgot-password src/app/reset-password tests/lib/auth/passwordReset.test.ts
git commit -m "feat: add login and password reset flow"
```

---

### Task 8: Guardian consent flow

**Files:**
- Create: `src/lib/onboarding/guardianConsent.ts`
- Create: `src/app/guardian-consent/[token]/page.tsx`
- Test: `tests/lib/onboarding/guardianConsent.test.ts`
- Test: `tests/app/guardian-consent-page.test.tsx`

**Interfaces:**
- Consumes: `generateToken` (Task 3), `sendEmail` (Task 4), `prisma` (Task 2).
- Produces: `requestGuardianConsent(studentProfileId: string, guardian: { name: string; email: string }): Promise<Guardian>`, `approveGuardianConsent(token: string): Promise<{ success: boolean; error?: string; alreadyApproved?: boolean }>` — consumed by Task 9 and Task 11.

- [ ] **Step 1: Write failing tests**

`tests/lib/onboarding/guardianConsent.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: { guardian: { upsert: vi.fn(), findUnique: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn() }));

import { prisma } from "@/lib/db/prisma";
import { sendEmail } from "@/lib/email/send";
import { requestGuardianConsent, approveGuardianConsent } from "@/lib/onboarding/guardianConsent";

describe("requestGuardianConsent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stores the guardian and emails a consent link", async () => {
    (prisma.guardian.upsert as any).mockResolvedValue({ id: "g1" });
    await requestGuardianConsent("profile1", { name: "Parent", email: "parent@example.test" });
    expect(prisma.guardian.upsert).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "parent@example.test" }));
  });
});

describe("approveGuardianConsent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects an unknown token without revealing anything about it", async () => {
    (prisma.guardian.findUnique as any).mockResolvedValue(null);
    const result = await approveGuardianConsent("bad-token");
    expect(result.success).toBe(false);
  });

  it("is idempotent when the link is opened again after already being approved", async () => {
    (prisma.guardian.findUnique as any).mockResolvedValue({ id: "g1", consentGivenAt: new Date() });
    const result = await approveGuardianConsent("t1");
    expect(result.success).toBe(true);
    expect(result.alreadyApproved).toBe(true);
    expect(prisma.guardian.update).not.toHaveBeenCalled();
  });

  it("records consent on first approval", async () => {
    (prisma.guardian.findUnique as any).mockResolvedValue({ id: "g1", consentGivenAt: null });
    const result = await approveGuardianConsent("t1");
    expect(result.success).toBe(true);
    expect(prisma.guardian.update).toHaveBeenCalledWith({
      where: { id: "g1" },
      data: { consentGivenAt: expect.any(Date) },
    });
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npx vitest run tests/lib/onboarding/guardianConsent.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/onboarding/guardianConsent.ts`:
```typescript
"use server";

import { prisma } from "@/lib/db/prisma";
import { generateToken } from "@/lib/validation/tokens";
import { sendEmail } from "@/lib/email/send";

export async function requestGuardianConsent(
  studentProfileId: string,
  guardian: { name: string; email: string },
) {
  const token = generateToken();
  const record = await prisma.guardian.upsert({
    where: { studentProfileId },
    update: {
      name: guardian.name,
      email: guardian.email,
      consentToken: token,
      consentRequestedAt: new Date(),
      consentGivenAt: null,
    },
    create: { studentProfileId, name: guardian.name, email: guardian.email, consentToken: token },
  });

  await sendEmail({
    to: guardian.email,
    subject: "Approve your student's Study Reminder account",
    body: `Your student added you as their guardian. Approve here: ${process.env.NEXT_PUBLIC_APP_URL}/guardian-consent/${token}`,
  });

  return record;
}

export async function approveGuardianConsent(
  token: string,
): Promise<{ success: boolean; error?: string; alreadyApproved?: boolean }> {
  const guardian = await prisma.guardian.findUnique({ where: { consentToken: token } });
  if (!guardian) {
    return { success: false, error: "This consent link is invalid." };
  }
  if (guardian.consentGivenAt) {
    return { success: true, alreadyApproved: true };
  }

  await prisma.guardian.update({ where: { id: guardian.id }, data: { consentGivenAt: new Date() } });
  return { success: true };
}
```

- [ ] **Step 4: Run and verify pass**

Run: `npx vitest run tests/lib/onboarding/guardianConsent.test.ts`
Expected: PASS

- [ ] **Step 5: Build the consent page**

`src/app/guardian-consent/[token]/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { approveGuardianConsent } from "@/lib/onboarding/guardianConsent";

export default function GuardianConsentPage() {
  const params = useParams<{ token: string }>();
  const [result, setResult] = useState<{ success: boolean; error?: string; alreadyApproved?: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleApprove() {
    setSubmitting(true);
    const outcome = await approveGuardianConsent(params.token);
    setResult(outcome);
    setSubmitting(false);
  }

  if (result) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        {result.success ? (
          <p className="text-slate-600">
            {result.alreadyApproved
              ? "This account was already approved. Thank you!"
              : "Thank you — you've approved this student's account."}
          </p>
        ) : (
          <p className="text-red-600">{result.error}</p>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="mb-4 text-2xl font-semibold text-pink-dark">Guardian approval requested</h1>
      <p className="mb-8 text-slate-600">
        A student has listed you as their guardian on Study Reminder and needs your consent to use the app.
      </p>
      <button
        onClick={handleApprove}
        disabled={submitting}
        className="rounded-full bg-pink px-6 py-3 font-medium text-white hover:bg-pink-dark disabled:opacity-60"
      >
        {submitting ? "Submitting..." : "Yes, I approve"}
      </button>
    </main>
  );
}
```

- [ ] **Step 6: Write a failing component test for the consent page**

`tests/app/guardian-consent-page.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import GuardianConsentPage from "@/app/guardian-consent/[token]/page";

vi.mock("next/navigation", () => ({ useParams: () => ({ token: "t1" }) }));
vi.mock("@/lib/onboarding/guardianConsent", () => ({ approveGuardianConsent: vi.fn() }));

import { approveGuardianConsent } from "@/lib/onboarding/guardianConsent";

describe("GuardianConsentPage", () => {
  it("shows the approval confirmation after clicking approve", async () => {
    (approveGuardianConsent as any).mockResolvedValue({ success: true });
    render(<GuardianConsentPage />);

    fireEvent.click(screen.getByRole("button", { name: /i approve/i }));

    await waitFor(() => {
      expect(screen.getByText(/you've approved this student's account/i)).toBeInTheDocument();
    });
  });

  it("shows the already-approved message when the link was used before", async () => {
    (approveGuardianConsent as any).mockResolvedValue({ success: true, alreadyApproved: true });
    render(<GuardianConsentPage />);

    fireEvent.click(screen.getByRole("button", { name: /i approve/i }));

    await waitFor(() => {
      expect(screen.getByText(/already approved/i)).toBeInTheDocument();
    });
  });

  it("shows the error message for an invalid token", async () => {
    (approveGuardianConsent as any).mockResolvedValue({ success: false, error: "This consent link is invalid." });
    render(<GuardianConsentPage />);

    fireEvent.click(screen.getByRole("button", { name: /i approve/i }));

    await waitFor(() => {
      expect(screen.getByText(/this consent link is invalid/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 7: Run and verify failure, then pass**

Run: `npx vitest run tests/app/guardian-consent-page.test.tsx`
Expected: once Step 5's page component exists, all three assertions PASS without further changes — they exercise the `result` state branches already written.

- [ ] **Step 8: Commit**

```bash
git add src/lib/onboarding/guardianConsent.ts src/app/guardian-consent tests/lib/onboarding/guardianConsent.test.ts tests/app/guardian-consent-page.test.tsx
git commit -m "feat: add guardian consent request and approval flow"
```

---

### Task 9: Onboarding wizard

**Files:**
- Create: `src/lib/onboarding/completeOnboarding.ts`
- Create: `src/app/onboarding/page.tsx`
- Create: `src/app/onboarding/OnboardingWizard.tsx`
- Test: `tests/lib/onboarding/completeOnboarding.test.ts`
- Test: `tests/app/onboarding-wizard.test.tsx`

**Interfaces:**
- Consumes: `requiresGuardianConsent` (Task 3), `hasOverlap` (Task 3), `requestGuardianConsent` (Task 8), `getCurrentSessionUser` (Task 5), `prisma` (Task 2).
- Produces: `completeOnboarding(input: OnboardingInput): Promise<{ success: boolean; error?: string; guardianConsentRequired?: boolean }>`

- [ ] **Step 1: Write failing tests**

`tests/lib/onboarding/completeOnboarding.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: { studentProfile: { create: vi.fn() }, timetableEntry: { createMany: vi.fn() }, goal: { createMany: vi.fn() } },
}));
vi.mock("@/lib/onboarding/guardianConsent", () => ({ requestGuardianConsent: vi.fn() }));

import { prisma } from "@/lib/db/prisma";
import { requestGuardianConsent } from "@/lib/onboarding/guardianConsent";
import { completeOnboarding, type OnboardingInput } from "@/lib/onboarding/completeOnboarding";

function baseInput(overrides: Partial<OnboardingInput> = {}): OnboardingInput {
  return {
    userId: "u1",
    name: "Alex",
    dateOfBirth: "2010-01-01",
    grade: "9",
    schoolName: "Maple High",
    curriculum: "State Board",
    academicYear: "2026-2027",
    timezone: "Asia/Kolkata",
    subjects: ["Math", "Science"],
    timetable: [],
    availability: [],
    goals: [],
    reminderChannel: "none",
    preferredTimes: [],
    ...overrides,
  };
}

describe("completeOnboarding", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects overlapping timetable entries before writing anything", async () => {
    const input = baseInput({
      timetable: [
        { dayOfWeek: 1, startTime: "09:00", endTime: "10:30" },
        { dayOfWeek: 1, startTime: "10:00", endTime: "11:00" },
      ],
    });
    const result = await completeOnboarding(input);
    expect(result.success).toBe(false);
    expect(prisma.studentProfile.create).not.toHaveBeenCalled();
  });

  it("requires a guardian when the student is under 18", async () => {
    const input = baseInput({ dateOfBirth: "2015-01-01" });
    const result = await completeOnboarding(input);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/guardian/i);
  });

  it("does not require a guardian for a student whose 18th birthday is today", async () => {
    const eighteenToday = new Date();
    eighteenToday.setFullYear(eighteenToday.getFullYear() - 18);
    (prisma.studentProfile.create as any).mockResolvedValue({ id: "p1", subjects: [] });

    const input = baseInput({ dateOfBirth: eighteenToday.toISOString().slice(0, 10) });
    const result = await completeOnboarding(input);

    expect(result.success).toBe(true);
    expect(result.guardianConsentRequired).toBe(false);
    expect(requestGuardianConsent).not.toHaveBeenCalled();
  });

  it("creates the profile and requests guardian consent when under 18 with a guardian provided", async () => {
    (prisma.studentProfile.create as any).mockResolvedValue({ id: "p1", subjects: [] });

    const input = baseInput({
      dateOfBirth: "2015-01-01",
      guardian: { name: "Parent", email: "parent@example.test" },
    });
    const result = await completeOnboarding(input);

    expect(result.success).toBe(true);
    expect(result.guardianConsentRequired).toBe(true);
    expect(requestGuardianConsent).toHaveBeenCalledWith("p1", { name: "Parent", email: "parent@example.test" });
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npx vitest run tests/lib/onboarding/completeOnboarding.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/onboarding/completeOnboarding.ts`:
```typescript
"use server";

import { prisma } from "@/lib/db/prisma";
import { requiresGuardianConsent } from "@/lib/validation/age";
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
  const guardianRequired = requiresGuardianConsent(dob);
  if (guardianRequired && !input.guardian) {
    return { success: false, error: "A guardian name and email are required for students under 18." };
  }

  const profile = await prisma.studentProfile.create({
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

  const subjectIdByName = new Map(profile.subjects.map((s: { id: string; name: string }) => [s.name, s.id]));

  if (input.timetable.length) {
    await prisma.timetableEntry.createMany({
      data: input.timetable.map((t) => ({
        studentProfileId: profile.id,
        dayOfWeek: t.dayOfWeek,
        subjectId: t.subjectName ? subjectIdByName.get(t.subjectName) ?? null : null,
        startTime: t.startTime,
        endTime: t.endTime,
      })),
    });
  }

  if (input.goals.length) {
    await prisma.goal.createMany({
      data: input.goals.map((g) => ({
        studentProfileId: profile.id,
        subjectId: g.subjectName ? subjectIdByName.get(g.subjectName) ?? null : null,
        description: g.description,
        examDate: g.examDate ? new Date(g.examDate) : null,
      })),
    });
  }

  if (guardianRequired && input.guardian) {
    await requestGuardianConsent(profile.id, input.guardian);
  }

  return { success: true, guardianConsentRequired: guardianRequired };
}
```

- [ ] **Step 4: Run and verify pass**

Run: `npx vitest run tests/lib/onboarding/completeOnboarding.test.ts`
Expected: PASS

- [ ] **Step 5: Build the onboarding wizard UI**

`src/app/onboarding/OnboardingWizard.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { completeOnboarding, type OnboardingInput } from "@/lib/onboarding/completeOnboarding";

const STEPS = ["Basics", "Subjects", "Timetable", "Availability", "Goals", "Reminders"] as const;

export function OnboardingWizard({ userId }: { userId: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState<Omit<OnboardingInput, "userId">>({
    name: "",
    dateOfBirth: "",
    grade: "",
    schoolName: "",
    curriculum: "",
    academicYear: "",
    gender: undefined,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    subjects: [],
    timetable: [],
    availability: [],
    goals: [],
    reminderChannel: "none",
    preferredTimes: [],
    phone: undefined,
    guardian: undefined,
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleFinish() {
    setSubmitting(true);
    setError(null);
    const result = await completeOnboarding({ userId, ...form });
    if (result.success) {
      router.push("/dashboard");
    } else {
      setError(result.error ?? "Something went wrong.");
      setSubmitting(false);
    }
  }

  const isMinor = form.dateOfBirth
    ? new Date().getFullYear() - new Date(form.dateOfBirth).getFullYear() < 19 // rough client-side hint only; the server re-checks the exact rule
    : false;

  const basicsComplete =
    form.name.trim() !== "" &&
    form.dateOfBirth !== "" &&
    form.grade.trim() !== "" &&
    form.schoolName.trim() !== "" &&
    form.curriculum.trim() !== "" &&
    form.academicYear.trim() !== "";
  const guardianComplete = !isMinor || (!!form.guardian?.name.trim() && !!form.guardian?.email.trim());
  const canLeaveStep0 = basicsComplete && guardianComplete;
  const canProceed = step === 0 ? canLeaveStep0 : true;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="mb-8 flex gap-2">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`h-1 flex-1 rounded-full ${i <= step ? "bg-pink" : "bg-blush"}`}
          />
        ))}
      </div>
      <h1 className="mb-6 text-2xl font-semibold text-pink-dark">{STEPS[step]}</h1>

      {step === 0 && (
        <div className="flex flex-col gap-4">
          <input
            placeholder="Your name"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            className="rounded-lg border border-lavender px-4 py-2"
          />
          <input
            type="date"
            value={form.dateOfBirth}
            onChange={(e) => update("dateOfBirth", e.target.value)}
            className="rounded-lg border border-lavender px-4 py-2"
          />
          <input
            placeholder="Grade / class"
            value={form.grade}
            onChange={(e) => update("grade", e.target.value)}
            className="rounded-lg border border-lavender px-4 py-2"
          />
          <input
            placeholder="School name"
            value={form.schoolName}
            onChange={(e) => update("schoolName", e.target.value)}
            className="rounded-lg border border-lavender px-4 py-2"
          />
          <input
            placeholder="Curriculum (e.g. CBSE, IB, State Board)"
            value={form.curriculum}
            onChange={(e) => update("curriculum", e.target.value)}
            className="rounded-lg border border-lavender px-4 py-2"
          />
          <input
            placeholder="Academic year (e.g. 2026-2027)"
            value={form.academicYear}
            onChange={(e) => update("academicYear", e.target.value)}
            className="rounded-lg border border-lavender px-4 py-2"
          />
          <select
            value={form.gender ?? ""}
            onChange={(e) => update("gender", e.target.value || undefined)}
            className="rounded-lg border border-lavender px-4 py-2"
          >
            <option value="">Prefer not to say</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="nonbinary">Non-binary</option>
          </select>
          {isMinor && (
            <div className="rounded-lg bg-blush p-4">
              <p className="mb-2 text-sm text-slate-600">
                Since you may be under 18, we need a guardian&apos;s name and email to approve your account.
              </p>
              <input
                placeholder="Guardian name"
                value={form.guardian?.name ?? ""}
                onChange={(e) => update("guardian", { name: e.target.value, email: form.guardian?.email ?? "" })}
                className="mb-2 w-full rounded-lg border border-lavender px-4 py-2"
              />
              <input
                placeholder="Guardian email"
                value={form.guardian?.email ?? ""}
                onChange={(e) => update("guardian", { name: form.guardian?.name ?? "", email: e.target.value })}
                className="w-full rounded-lg border border-lavender px-4 py-2"
              />
            </div>
          )}
        </div>
      )}

      {step === 1 && (
        <SubjectStep subjects={form.subjects} onChange={(subjects) => update("subjects", subjects)} />
      )}

      {step === 2 && (
        <TimetableStep
          subjects={form.subjects}
          entries={form.timetable}
          onChange={(timetable) => update("timetable", timetable)}
        />
      )}

      {step === 3 && (
        <AvailabilityStep
          entries={form.availability}
          onChange={(availability) => update("availability", availability)}
        />
      )}

      {step === 4 && (
        <GoalsStep subjects={form.subjects} goals={form.goals} onChange={(goals) => update("goals", goals)} />
      )}

      {step === 5 && (
        <ReminderStep
          channel={form.reminderChannel}
          preferredTimes={form.preferredTimes}
          phone={form.phone}
          onChannelChange={(c) => update("reminderChannel", c)}
          onTimesChange={(t) => update("preferredTimes", t)}
          onPhoneChange={(p) => update("phone", p)}
        />
      )}

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-8 flex justify-between">
        <button
          disabled={step === 0}
          onClick={() => setStep((s) => s - 1)}
          className="rounded-full border border-lavender px-6 py-2 text-lavender-dark disabled:opacity-40"
        >
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canProceed}
            className="rounded-full bg-pink px-6 py-2 font-medium text-white hover:bg-pink-dark disabled:opacity-40"
          >
            Next
          </button>
        ) : (
          <button
            onClick={handleFinish}
            disabled={submitting || !canProceed}
            className="rounded-full bg-pink px-6 py-2 font-medium text-white hover:bg-pink-dark disabled:opacity-60"
          >
            {submitting ? "Saving..." : "Finish"}
          </button>
        )}
      </div>
      {step === 0 && !canProceed && (
        <p className="mt-2 text-right text-xs text-slate-500">
          {!basicsComplete
            ? "Fill in all the basics above to continue."
            : "A guardian name and email are required for students under 18."}
        </p>
      )}
    </main>
  );
}

function SubjectStep({ subjects, onChange }: { subjects: string[]; onChange: (s: string[]) => void }) {
  const [draft, setDraft] = useState("");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a subject"
          className="flex-1 rounded-lg border border-lavender px-4 py-2"
        />
        <button
          type="button"
          onClick={() => {
            if (draft.trim()) {
              onChange([...subjects, draft.trim()]);
              setDraft("");
            }
          }}
          className="rounded-lg bg-lavender px-4 py-2 text-white"
        >
          Add
        </button>
      </div>
      <ul className="flex flex-wrap gap-2">
        {subjects.map((s) => (
          <li key={s} className="rounded-full bg-blush px-3 py-1 text-sm">
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TimetableStep({
  subjects,
  entries,
  onChange,
}: {
  subjects: string[];
  entries: OnboardingInput["timetable"];
  onChange: (e: OnboardingInput["timetable"]) => void;
}) {
  const [draft, setDraft] = useState({ dayOfWeek: 1, subjectName: subjects[0] ?? "", startTime: "09:00", endTime: "10:00" });
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        <select
          value={draft.dayOfWeek}
          onChange={(e) => setDraft({ ...draft, dayOfWeek: Number(e.target.value) })}
          className="rounded-lg border border-lavender px-4 py-2"
        >
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
            <option key={d} value={i}>{d}</option>
          ))}
        </select>
        <select
          value={draft.subjectName}
          onChange={(e) => setDraft({ ...draft, subjectName: e.target.value })}
          className="rounded-lg border border-lavender px-4 py-2"
        >
          {subjects.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input
          type="time"
          value={draft.startTime}
          onChange={(e) => setDraft({ ...draft, startTime: e.target.value })}
          className="rounded-lg border border-lavender px-4 py-2"
        />
        <input
          type="time"
          value={draft.endTime}
          onChange={(e) => setDraft({ ...draft, endTime: e.target.value })}
          className="rounded-lg border border-lavender px-4 py-2"
        />
      </div>
      <button
        type="button"
        onClick={() => onChange([...entries, draft])}
        className="self-start rounded-lg bg-lavender px-4 py-2 text-white"
      >
        Add period
      </button>
      <ul className="flex flex-col gap-1 text-sm">
        {entries.map((e, i) => (
          <li key={i}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][e.dayOfWeek]} {e.startTime}-{e.endTime} {e.subjectName}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AvailabilityStep({
  entries,
  onChange,
}: {
  entries: OnboardingInput["availability"];
  onChange: (e: OnboardingInput["availability"]) => void;
}) {
  const [draft, setDraft] = useState({ dayOfWeek: 1, startTime: "17:00", endTime: "19:00" });
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600">When are you free to study at home?</p>
      <div className="grid grid-cols-2 gap-2">
        <select
          value={draft.dayOfWeek}
          onChange={(e) => setDraft({ ...draft, dayOfWeek: Number(e.target.value) })}
          className="rounded-lg border border-lavender px-4 py-2"
        >
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
            <option key={d} value={i}>{d}</option>
          ))}
        </select>
        <input
          type="time"
          value={draft.startTime}
          onChange={(e) => setDraft({ ...draft, startTime: e.target.value })}
          className="rounded-lg border border-lavender px-4 py-2"
        />
        <input
          type="time"
          value={draft.endTime}
          onChange={(e) => setDraft({ ...draft, endTime: e.target.value })}
          className="rounded-lg border border-lavender px-4 py-2"
        />
      </div>
      <button
        type="button"
        onClick={() => onChange([...entries, draft])}
        className="self-start rounded-lg bg-lavender px-4 py-2 text-white"
      >
        Add window
      </button>
    </div>
  );
}

function GoalsStep({
  subjects,
  goals,
  onChange,
}: {
  subjects: string[];
  goals: OnboardingInput["goals"];
  onChange: (g: OnboardingInput["goals"]) => void;
}) {
  const [draft, setDraft] = useState({ description: "", examDate: "", subjectName: subjects[0] ?? "" });
  return (
    <div className="flex flex-col gap-4">
      <input
        placeholder="Study goal (e.g. Score 90% in Math)"
        value={draft.description}
        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        className="rounded-lg border border-lavender px-4 py-2"
      />
      <input
        type="date"
        value={draft.examDate}
        onChange={(e) => setDraft({ ...draft, examDate: e.target.value })}
        className="rounded-lg border border-lavender px-4 py-2"
      />
      <button
        type="button"
        onClick={() => {
          if (draft.description.trim()) {
            onChange([...goals, draft]);
            setDraft({ description: "", examDate: "", subjectName: subjects[0] ?? "" });
          }
        }}
        className="self-start rounded-lg bg-lavender px-4 py-2 text-white"
      >
        Add goal
      </button>
      <ul className="text-sm">
        {goals.map((g, i) => (
          <li key={i}>{g.description}{g.examDate ? ` (by ${g.examDate})` : ""}</li>
        ))}
      </ul>
    </div>
  );
}

function ReminderStep({
  channel,
  preferredTimes,
  phone,
  onChannelChange,
  onTimesChange,
  onPhoneChange,
}: {
  channel: OnboardingInput["reminderChannel"];
  preferredTimes: string[];
  phone?: string;
  onChannelChange: (c: OnboardingInput["reminderChannel"]) => void;
  onTimesChange: (t: string[]) => void;
  onPhoneChange: (p: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <select
        value={channel}
        onChange={(e) => onChannelChange(e.target.value as OnboardingInput["reminderChannel"])}
        className="rounded-lg border border-lavender px-4 py-2"
      >
        <option value="none">No reminders for now</option>
        <option value="browser">Browser notifications</option>
        <option value="email">Email</option>
        <option value="whatsapp">WhatsApp</option>
      </select>
      <input
        type="time"
        value={preferredTimes[0] ?? ""}
        onChange={(e) => onTimesChange([e.target.value])}
        className="rounded-lg border border-lavender px-4 py-2"
      />
      {channel === "whatsapp" && (
        <input
          placeholder="Phone number (with country code)"
          value={phone ?? ""}
          onChange={(e) => onPhoneChange(e.target.value)}
          className="rounded-lg border border-lavender px-4 py-2"
        />
      )}
      <p className="text-xs text-slate-500">
        WhatsApp delivery isn&apos;t wired up yet — that arrives in a later phase. Your preference is saved either way.
      </p>
    </div>
  );
}
```

- [ ] **Step 6: Write a failing component test for step validation**

`tests/app/onboarding-wizard.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OnboardingWizard } from "@/app/onboarding/OnboardingWizard";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/onboarding/completeOnboarding", () => ({ completeOnboarding: vi.fn() }));

describe("OnboardingWizard", () => {
  it("keeps Next disabled until the basics step is filled in", () => {
    render(<OnboardingWizard userId="u1" />);
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/your name/i), { target: { value: "Alex" } });
    fireEvent.change(screen.getByPlaceholderText(/grade/i), { target: { value: "9" } });
    fireEvent.change(screen.getByPlaceholderText(/school name/i), { target: { value: "Maple High" } });
    fireEvent.change(screen.getByPlaceholderText(/curriculum/i), { target: { value: "CBSE" } });
    fireEvent.change(screen.getByPlaceholderText(/academic year/i), { target: { value: "2026-2027" } });

    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled(); // DOB still missing
  });

  it("requires guardian fields once a date of birth implies the student is a minor", () => {
    render(<OnboardingWizard userId="u1" />);
    const dobInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dobInput, { target: { value: "2015-01-01" } });

    expect(screen.getByPlaceholderText(/guardian name/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
  });
});
```

- [ ] **Step 7: Run and verify failure**

Run: `npx vitest run tests/app/onboarding-wizard.test.tsx`
Expected: FAIL — `OnboardingWizard` not exported yet (this task's Step 5 code hasn't been saved as a file on disk yet — write Step 5's code to `src/app/onboarding/OnboardingWizard.tsx` first if doing these steps out of order, then re-run to see the true red state for this specific test file before continuing).

- [ ] **Step 8: Run and verify pass**

Run: `npx vitest run tests/app/onboarding-wizard.test.tsx`
Expected: PASS (the component already built in Step 5 satisfies both assertions, since `canProceed` is wired to the Next/Finish buttons' `disabled` prop).

- [ ] **Step 9: Build the onboarding server page**

`src/app/onboarding/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { OnboardingWizard } from "./OnboardingWizard";

export default async function OnboardingPage() {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/login");

  return <OnboardingWizard userId={user.id} />;
}
```

- [ ] **Step 10: Commit**

```bash
git add src/lib/onboarding/completeOnboarding.ts src/app/onboarding tests/lib/onboarding/completeOnboarding.test.ts tests/app/onboarding-wizard.test.tsx
git commit -m "feat: add onboarding wizard and profile creation"
```

---

### Task 10: Dashboard shell

**Files:**
- Create: `src/lib/dashboard/bannerState.ts`
- Create: `src/app/dashboard/page.tsx`
- Test: `tests/lib/dashboard/bannerState.test.ts`

**Interfaces:**
- Consumes: `getCurrentSessionUser` (Task 5), `prisma` (Task 2).
- Produces: `getDashboardBannerState(guardian: { consentGivenAt: Date | null } | null): "none" | "guardian-pending"`

- [ ] **Step 1: Write failing test**

`tests/lib/dashboard/bannerState.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { getDashboardBannerState } from "@/lib/dashboard/bannerState";

describe("getDashboardBannerState", () => {
  it("returns none when there is no guardian", () => {
    expect(getDashboardBannerState(null)).toBe("none");
  });

  it("returns guardian-pending when consent hasn't been given", () => {
    expect(getDashboardBannerState({ consentGivenAt: null })).toBe("guardian-pending");
  });

  it("returns none once consent has been given", () => {
    expect(getDashboardBannerState({ consentGivenAt: new Date() })).toBe("none");
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npx vitest run tests/lib/dashboard/bannerState.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/dashboard/bannerState.ts`:
```typescript
export type BannerState = "none" | "guardian-pending";

export function getDashboardBannerState(guardian: { consentGivenAt: Date | null } | null): BannerState {
  if (guardian && !guardian.consentGivenAt) return "guardian-pending";
  return "none";
}
```

- [ ] **Step 4: Run and verify pass**

Run: `npx vitest run tests/lib/dashboard/bannerState.test.ts`
Expected: PASS

- [ ] **Step 5: Build the dashboard page**

`src/app/dashboard/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getDashboardBannerState } from "@/lib/dashboard/bannerState";

export default async function DashboardPage() {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/login");

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
    include: { guardian: true, subjects: true },
  });
  if (!profile) redirect("/onboarding");

  const banner = getDashboardBannerState(profile.guardian);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      {banner === "guardian-pending" && (
        <div className="mb-6 rounded-xl bg-blush p-4 text-sm text-slate-700">
          Waiting for your guardian ({profile.guardian?.email}) to approve your account.{" "}
          <Link href="/profile" className="underline">Resend or update guardian info</Link>
        </div>
      )}

      <h1 className="mb-2 text-3xl font-semibold text-pink-dark">Hi {profile.name} 👋</h1>
      <p className="mb-8 text-slate-600">
        {profile.schoolName} · Grade {profile.grade} · {profile.curriculum}
      </p>

      <section className="mb-8 rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-medium text-lavender-dark">Your subjects</h2>
        <ul className="flex flex-wrap gap-2">
          {profile.subjects.map((s) => (
            <li key={s.id} className="rounded-full bg-blush px-3 py-1 text-sm">{s.name}</li>
          ))}
        </ul>
      </section>

      {(["Study plan", "Homework & tasks", "Daily check-in", "Progress reports"] as const).map((label) => (
        <section key={label} className="mb-4 rounded-xl border border-dashed border-lavender p-6 text-slate-500">
          {label} is coming in a later phase.
        </section>
      ))}
    </main>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/dashboard src/app/dashboard tests/lib/dashboard
git commit -m "feat: add dashboard shell with guardian-pending banner"
```

---

### Task 11: Profile/settings edit page

**Files:**
- Create: `src/lib/onboarding/updateProfile.ts`
- Create: `src/app/profile/ProfileEditForm.tsx`
- Create: `src/app/profile/page.tsx`
- Test: `tests/lib/onboarding/updateProfile.test.ts`

**Interfaces:**
- Consumes: `requiresGuardianConsent` (Task 3), `requestGuardianConsent` (Task 8), `getCurrentSessionUser` (Task 5), `prisma` (Task 2).
- Produces: `updateStudentProfile(userId: string, changes: Partial<ProfileEditableFields>): Promise<{ success: boolean; error?: string }>`

- [ ] **Step 1: Write failing tests**

`tests/lib/onboarding/updateProfile.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: { studentProfile: { findUnique: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/lib/onboarding/guardianConsent", () => ({ requestGuardianConsent: vi.fn() }));

import { prisma } from "@/lib/db/prisma";
import { requestGuardianConsent } from "@/lib/onboarding/guardianConsent";
import { updateStudentProfile } from "@/lib/onboarding/updateProfile";

describe("updateStudentProfile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not re-trigger guardian consent for an unrelated field change", async () => {
    (prisma.studentProfile.findUnique as any).mockResolvedValue({
      id: "p1",
      dateOfBirth: new Date("2000-01-01"),
      guardian: null,
    });
    await updateStudentProfile("u1", { schoolName: "New School" });
    expect(requestGuardianConsent).not.toHaveBeenCalled();
  });

  it("re-triggers guardian consent when a DOB edit makes the student under 18", async () => {
    (prisma.studentProfile.findUnique as any).mockResolvedValue({
      id: "p1",
      dateOfBirth: new Date("2000-01-01"),
      guardian: null,
    });
    await updateStudentProfile("u1", {
      dateOfBirth: "2015-01-01",
      guardian: { name: "Parent", email: "parent@example.test" },
    });
    expect(requestGuardianConsent).toHaveBeenCalledWith("p1", { name: "Parent", email: "parent@example.test" });
  });

  it("re-triggers guardian consent when the guardian's email changes while still required", async () => {
    (prisma.studentProfile.findUnique as any).mockResolvedValue({
      id: "p1",
      dateOfBirth: new Date("2015-01-01"),
      guardian: { name: "Old Parent", email: "old@example.test", consentGivenAt: new Date() },
    });
    await updateStudentProfile("u1", { guardian: { name: "Old Parent", email: "new@example.test" } });
    expect(requestGuardianConsent).toHaveBeenCalledWith("p1", { name: "Old Parent", email: "new@example.test" });
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npx vitest run tests/lib/onboarding/updateProfile.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/onboarding/updateProfile.ts`:
```typescript
"use server";

import { prisma } from "@/lib/db/prisma";
import { requiresGuardianConsent } from "@/lib/validation/age";
import { requestGuardianConsent } from "./guardianConsent";

export interface ProfileEditableFields {
  name: string;
  dateOfBirth: string;
  grade: string;
  schoolName: string;
  curriculum: string;
  academicYear: string;
  gender?: string;
  timezone: string;
  guardian?: { name: string; email: string };
}

export async function updateStudentProfile(
  userId: string,
  changes: Partial<ProfileEditableFields>,
): Promise<{ success: boolean; error?: string }> {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId },
    include: { guardian: true },
  });
  if (!profile) {
    return { success: false, error: "Profile not found." };
  }

  const newDob = changes.dateOfBirth ? new Date(changes.dateOfBirth) : profile.dateOfBirth;
  const guardianNowRequired = requiresGuardianConsent(newDob);

  const guardianInfoChanged =
    !!changes.guardian &&
    (changes.guardian.name !== profile.guardian?.name || changes.guardian.email !== profile.guardian?.email);

  await prisma.studentProfile.update({
    where: { userId },
    data: {
      ...(changes.name && { name: changes.name }),
      ...(changes.dateOfBirth && { dateOfBirth: newDob }),
      ...(changes.grade && { grade: changes.grade }),
      ...(changes.schoolName && { schoolName: changes.schoolName }),
      ...(changes.curriculum && { curriculum: changes.curriculum }),
      ...(changes.academicYear && { academicYear: changes.academicYear }),
      ...(changes.gender !== undefined && { gender: changes.gender }),
      ...(changes.timezone && { timezone: changes.timezone }),
    },
  });

  if (guardianNowRequired && changes.guardian && guardianInfoChanged) {
    await requestGuardianConsent(profile.id, changes.guardian);
  }

  return { success: true };
}
```

- [ ] **Step 4: Run and verify pass**

Run: `npx vitest run tests/lib/onboarding/updateProfile.test.ts`
Expected: PASS

- [ ] **Step 5: Build the profile edit form (client component)**

`src/app/profile/ProfileEditForm.tsx`:
```tsx
"use client";

import { useState } from "react";
import { updateStudentProfile, type ProfileEditableFields } from "@/lib/onboarding/updateProfile";

export interface ProfileEditFormProps {
  userId: string;
  initial: ProfileEditableFields;
  guardianStatus: { email: string; approved: boolean } | null;
}

export function ProfileEditForm({ userId, initial, guardianStatus }: ProfileEditFormProps) {
  const [form, setForm] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof ProfileEditableFields>(key: K, value: ProfileEditableFields[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError(null);
    const result = await updateStudentProfile(userId, form);
    if (result.success) {
      setStatus("saved");
    } else {
      setStatus("error");
      setError(result.error ?? "Something went wrong.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl bg-white p-6 shadow-sm">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700">Name</span>
        <input
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          className="rounded-lg border border-lavender px-4 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700">Date of birth</span>
        <input
          type="date"
          value={form.dateOfBirth}
          onChange={(e) => update("dateOfBirth", e.target.value)}
          className="rounded-lg border border-lavender px-4 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700">Grade</span>
        <input
          value={form.grade}
          onChange={(e) => update("grade", e.target.value)}
          className="rounded-lg border border-lavender px-4 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700">School</span>
        <input
          value={form.schoolName}
          onChange={(e) => update("schoolName", e.target.value)}
          className="rounded-lg border border-lavender px-4 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700">Curriculum</span>
        <input
          value={form.curriculum}
          onChange={(e) => update("curriculum", e.target.value)}
          className="rounded-lg border border-lavender px-4 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700">Academic year</span>
        <input
          value={form.academicYear}
          onChange={(e) => update("academicYear", e.target.value)}
          className="rounded-lg border border-lavender px-4 py-2"
        />
      </label>

      {guardianStatus && (
        <div className="rounded-lg bg-blush p-4">
          <p className="mb-2 text-sm text-slate-600">
            Guardian: {guardianStatus.email} — {guardianStatus.approved ? "approved" : "pending approval"}
          </p>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">Update guardian name</span>
            <input
              value={form.guardian?.name ?? ""}
              onChange={(e) => update("guardian", { name: e.target.value, email: form.guardian?.email ?? "" })}
              className="rounded-lg border border-lavender px-4 py-2"
            />
          </label>
          <label className="mt-2 flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">Update guardian email</span>
            <input
              value={form.guardian?.email ?? ""}
              onChange={(e) => update("guardian", { name: form.guardian?.name ?? "", email: e.target.value })}
              className="rounded-lg border border-lavender px-4 py-2"
            />
          </label>
          <p className="mt-2 text-xs text-slate-500">
            Changing the guardian&apos;s name or email will re-send a consent request.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {status === "saved" && <p className="text-sm text-green-700">Saved.</p>}

      <button
        type="submit"
        disabled={status === "saving"}
        className="self-start rounded-full bg-pink px-6 py-3 font-medium text-white hover:bg-pink-dark disabled:opacity-60"
      >
        {status === "saving" ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}
```

- [ ] **Step 6: Build the profile page (server component)**

`src/app/profile/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ProfileEditForm } from "./ProfileEditForm";

export default async function ProfilePage() {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/login");

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
    include: { guardian: true },
  });
  if (!profile) redirect("/onboarding");

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mb-8 text-2xl font-semibold text-pink-dark">Your profile</h1>
      <ProfileEditForm
        userId={user.id}
        initial={{
          name: profile.name,
          dateOfBirth: profile.dateOfBirth.toISOString().slice(0, 10),
          grade: profile.grade,
          schoolName: profile.schoolName,
          curriculum: profile.curriculum,
          academicYear: profile.academicYear,
          gender: profile.gender ?? undefined,
          timezone: profile.timezone,
          guardian: profile.guardian ? { name: profile.guardian.name, email: profile.guardian.email } : undefined,
        }}
        guardianStatus={
          profile.guardian
            ? { email: profile.guardian.email, approved: !!profile.guardian.consentGivenAt }
            : null
        }
      />
    </main>
  );
}
```

- [ ] **Step 7: Write a failing component test for the edit form**

`tests/app/profile-edit-form.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProfileEditForm } from "@/app/profile/ProfileEditForm";

vi.mock("@/lib/onboarding/updateProfile", () => ({ updateStudentProfile: vi.fn() }));
import { updateStudentProfile } from "@/lib/onboarding/updateProfile";

const initial = {
  name: "Alex",
  dateOfBirth: "2010-01-01",
  grade: "9",
  schoolName: "Maple High",
  curriculum: "CBSE",
  academicYear: "2026-2027",
  timezone: "Asia/Kolkata",
};

describe("ProfileEditForm", () => {
  it("submits the edited fields and shows a saved confirmation", async () => {
    (updateStudentProfile as any).mockResolvedValue({ success: true });
    render(<ProfileEditForm userId="u1" initial={initial} guardianStatus={null} />);

    fireEvent.change(screen.getByDisplayValue("Maple High"), { target: { value: "New School" } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(screen.getByText(/saved/i)).toBeInTheDocument());
    expect(updateStudentProfile).toHaveBeenCalledWith("u1", expect.objectContaining({ schoolName: "New School" }));
  });

  it("shows the server error message when the update fails", async () => {
    (updateStudentProfile as any).mockResolvedValue({ success: false, error: "Profile not found." });
    render(<ProfileEditForm userId="u1" initial={initial} guardianStatus={null} />);

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(screen.getByText(/profile not found/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 8: Run and verify pass**

Run: `npx vitest run tests/app/profile-edit-form.test.tsx`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/lib/onboarding/updateProfile.ts src/app/profile tests/lib/onboarding/updateProfile.test.ts tests/app/profile-edit-form.test.tsx
git commit -m "feat: add profile editing form wired to updateStudentProfile"
```

---

### Task 12: Rate limiting & final integration pass

**Files:**
- Create: `src/lib/security/rateLimit.ts`
- Modify: `prisma/schema.prisma` (already has `RateLimitAttempt` from Task 2 — no change needed)
- Modify: `src/lib/auth/signup.ts` (wire rate limit)
- Modify: `src/lib/auth/passwordReset.ts` (wire rate limit)
- Modify: `src/lib/onboarding/guardianConsent.ts` (wire rate limit on `requestGuardianConsent`)
- Test: `tests/lib/security/rateLimit.test.ts`

**Interfaces:**
- Produces: `checkRateLimit(options: { action: string; identifier: string; maxAttempts: number; windowMs: number }): Promise<{ allowed: boolean }>`

- [ ] **Step 1: Write failing test**

`tests/lib/security/rateLimit.test.ts`:
```typescript
import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { checkRateLimit } from "@/lib/security/rateLimit";

describe("checkRateLimit", () => {
  const identifier = `rl-test-${Date.now()}@example.test`;

  afterEach(async () => {
    await prisma.rateLimitAttempt.deleteMany({ where: { identifier } });
  });

  it("allows attempts up to the max, then blocks the next one", async () => {
    const options = { action: "signup", identifier, maxAttempts: 3, windowMs: 60_000 };
    expect((await checkRateLimit(options)).allowed).toBe(true);
    expect((await checkRateLimit(options)).allowed).toBe(true);
    expect((await checkRateLimit(options)).allowed).toBe(true);
    expect((await checkRateLimit(options)).allowed).toBe(false);
  });

  it("allows attempts again once the window has passed", async () => {
    await prisma.rateLimitAttempt.create({
      data: { action: "signup", identifier, createdAt: new Date(Date.now() - 120_000) },
    });
    const result = await checkRateLimit({ action: "signup", identifier, maxAttempts: 1, windowMs: 60_000 });
    expect(result.allowed).toBe(true);
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npx vitest run tests/lib/security/rateLimit.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/security/rateLimit.ts`:
```typescript
import { prisma } from "@/lib/db/prisma";

export interface RateLimitOptions {
  action: string;
  identifier: string;
  maxAttempts: number;
  windowMs: number;
}

export async function checkRateLimit({
  action,
  identifier,
  maxAttempts,
  windowMs,
}: RateLimitOptions): Promise<{ allowed: boolean }> {
  const windowStart = new Date(Date.now() - windowMs);
  const count = await prisma.rateLimitAttempt.count({
    where: { action, identifier, createdAt: { gte: windowStart } },
  });

  if (count >= maxAttempts) {
    return { allowed: false };
  }

  await prisma.rateLimitAttempt.create({ data: { action, identifier } });
  return { allowed: true };
}
```

- [ ] **Step 4: Run and verify pass**

Run: `npx vitest run tests/lib/security/rateLimit.test.ts`
Expected: PASS

- [ ] **Step 5: Wire rate limiting into signup**

Modify `src/lib/auth/signup.ts` — add near the top of `signupStudent`, after the password check:

```typescript
import { checkRateLimit } from "@/lib/security/rateLimit";

// ... inside signupStudent, after validatePassword check:
const rateLimit = await checkRateLimit({
  action: "signup",
  identifier: email,
  maxAttempts: 5,
  windowMs: 60 * 60 * 1000,
});
if (!rateLimit.allowed) {
  return { success: false, error: "Too many signup attempts. Please try again later." };
}
```

- [ ] **Step 6: Wire rate limiting into password reset requests**

Modify `src/lib/auth/passwordReset.ts` — add at the top of `requestPasswordReset`:

```typescript
import { checkRateLimit } from "@/lib/security/rateLimit";

// ... inside requestPasswordReset, before the user lookup:
const rateLimit = await checkRateLimit({
  action: "password_reset",
  identifier: email,
  maxAttempts: 5,
  windowMs: 60 * 60 * 1000,
});
if (!rateLimit.allowed) {
  return { success: true }; // still don't reveal anything; just silently skip sending
}
```

- [ ] **Step 7: Wire rate limiting into guardian consent resends**

Modify `src/lib/onboarding/guardianConsent.ts` — add at the top of `requestGuardianConsent`:

```typescript
import { checkRateLimit } from "@/lib/security/rateLimit";

// ... inside requestGuardianConsent, before the upsert:
const rateLimit = await checkRateLimit({
  action: "guardian_consent",
  identifier: studentProfileId,
  maxAttempts: 5,
  windowMs: 60 * 60 * 1000,
});
if (!rateLimit.allowed) {
  throw new Error("Too many consent requests sent recently. Please try again later.");
}
```

- [ ] **Step 8: Run the full test suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 9: Run a production build**

Run: `npm run build`
Expected: builds without type errors.

- [ ] **Step 10: Manual smoke test**

Run: `npm run dev`, then in the browser:
1. Sign up with a new email → confirm redirected to "check your email."
2. Open `/dev/emails` → confirm the verification email appears, copy its link.
3. Open the verification link → confirm "Email verified!" and log in.
4. Complete onboarding with a DOB that makes you under 18 → confirm guardian fields appear and are required.
5. After finishing onboarding, confirm the dashboard shows the "awaiting guardian approval" banner.
6. Open `/dev/emails` again, find the guardian consent email, open its link, click "Yes, I approve."
7. Reload the dashboard → confirm the banner is gone.
8. Visit `/profile` → confirm it shows the real data you entered.
9. Log out (browser dev tools: clear the session cookie, or add a temporary sign-out link) and log back in with the same credentials → confirm it works.
10. Try `/forgot-password` → confirm a reset email appears in `/dev/emails` and resetting the password works, then confirm the old password no longer logs you in (session revocation).

- [ ] **Step 11: Commit**

```bash
git add src/lib/security tests/lib/security src/lib/auth/signup.ts src/lib/auth/passwordReset.ts src/lib/onboarding/guardianConsent.ts
git commit -m "feat: add rate limiting to signup, password reset, and guardian consent"
```
