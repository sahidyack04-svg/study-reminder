# Phase 2 — Daily Core Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give students a real homework tracker and an auto-generated daily study plan, derived from their onboarding availability/subjects/goals, with inline check-in and automatic next-day carry-forward of unfinished work.

**Architecture:** Two new Prisma models (`Task`, `PlanEntry`) alongside the existing Phase 1 schema. A pure-function generator (`generatePlanEntries`) takes capacity + candidates and returns placements with no I/O, wrapped by a thin persistence layer (`planService.ts`) that handles session scoping, lazy per-date generation, and check-in writes. Two new pages (`/tasks`, `/plan`) follow the exact session-check + server-action pattern established in Phase 1. The dashboard's existing placeholder cards become real summaries.

**Tech Stack:** Same as Phase 1 — Next.js 15 (App Router) · TypeScript · Prisma (`sqlite`) · Vitest + Testing Library. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-15-phase2-daily-core-loop-design.md`

## Global Constraints

- Every student-owned row (`Task`, `PlanEntry`) is scoped by `studentProfileId` → `userId`, and every read/write goes through the current session's user id — no cross-student access. Every server action must independently resolve the acting user via `getCurrentSessionUser()`, never trust a client-supplied id (this is the exact class of bug Phase 1's final review found Critical — see that review if you want the incident, but the rule here is simple: resolve, don't trust).
- Dates representing a calendar day (`Task.dueDate`, `PlanEntry.date`, `PlanEntry.carriedOverFromDate`) are always UTC-midnight-anchored `Date` objects, parsed from `"YYYY-MM-DD"` strings the same way `StudentProfile.dateOfBirth` already is, and read back with UTC getters (`getUTCDay()`, etc.) — never local getters. This is the exact timezone bug class Phase 1 had to fix twice; don't reintroduce it.
- "Today" for plan generation is resolved via the existing `todayInTimezone(timezone)` from `@/lib/validation/age` (added in Phase 1), using the student's own declared `StudentProfile.timezone` — never a bare `new Date()`.
- `PlanEntry` rows are generated once per (student, date) and never implicitly regenerated — a date with zero existing entries triggers generation; a date with any existing entries is read as-is.
- A task's `estimatedMinutes` is never split across multiple `PlanEntry` rows or days — it either fits whole in a day's remaining capacity or it waits for a day with more room.
- Goal-filler `PlanEntry` rows (`taskId` null, `goalId` set) never carry forward if left unfinished — only task-backed entries do.
- No fabricated data: `/plan` and `/tasks` show only real, student-entered or generated data; a day with zero availability says so explicitly rather than rendering a blank or misleading state.

## Review Focus

- **A task-update/delete/check-in request references an id belonging to a different student** — must fail with a generic error that doesn't reveal whether the id exists at all, and must make no database change. Covered in Task 2 (`tasks.test.ts`) and Task 4 (`planService.test.ts`).
- **A task is marked done from `/tasks` directly (not via its plan entry)** — any of that task's still-`pending` `PlanEntry` rows must flip to `done` too, so `/tasks` and `/plan` can never disagree about the same task's completion. Covered in Task 2.
- **A weekday with zero `AvailabilityWindow` capacity** — plan generation must produce zero entries without crashing, and the page must say so explicitly rather than rendering a confusing empty section. Covered in Task 4 (`planService.test.ts`) and Task 6 (`plan-view.test.tsx`).
- **An open task has no `dueDate`** — must sort after every dated task without throwing, not crash the comparator or get silently dropped. Covered in Task 3 (`generatePlan.test.ts`).
- **The student skips visiting `/plan` for one or more days, then returns** — carry-forward only looks at the immediately preceding calendar day's actual `PlanEntry` rows (there are none for the skipped days, since generation is visit-triggered, not scheduled), so generation for the return day must succeed cleanly with nothing carried from further back than one day. Covered in Task 4.

---

## File Structure

```
study reminder/
├── prisma/
│   └── schema.prisma                      (modified: + Task, PlanEntry models)
├── src/
│   ├── lib/
│   │   ├── validation/timetable.ts        (modified: export toMinutes)
│   │   ├── tasks/
│   │   │   └── tasks.ts                   (listTasks, createTask, updateTask, deleteTask, markTaskDone)
│   │   └── plan/
│   │       ├── generatePlan.ts            (pure generator function)
│   │       └── planService.ts             (getOrGeneratePlanForDate, checkInPlanEntry)
│   └── app/
│       ├── tasks/
│       │   ├── page.tsx                   (server component)
│       │   └── TaskList.tsx               (client component)
│       ├── plan/
│       │   ├── page.tsx                   (server component)
│       │   └── PlanView.tsx               (client component)
│       └── dashboard/page.tsx             (modified: real summaries replace placeholders)
└── tests/
    ├── lib/
    │   ├── tasks/tasks.test.ts
    │   └── plan/
    │       ├── generatePlan.test.ts
    │       └── planService.test.ts
    └── app/
        ├── task-list.test.tsx
        └── plan-view.test.tsx
```

---

### Task 1: Database schema — `Task` and `PlanEntry` models

**Files:**
- Modify: `prisma/schema.prisma`
- Test: `tests/lib/db/taskPlanSchema.test.ts`

**Interfaces:**
- Produces: `Task` and `PlanEntry` Prisma models, queryable via the existing `prisma` singleton from `@/lib/db/prisma`.

- [ ] **Step 1: Add the models to the schema**

Add to `prisma/schema.prisma`, and add the two new back-relations to the existing `StudentProfile`, `Subject`, and `Goal` models as shown:

```prisma
model Task {
  id               String    @id @default(cuid())
  studentProfileId String
  subjectId        String?
  title            String
  dueDate          DateTime?
  estimatedMinutes Int
  status           String    @default("open") // "open" | "done"
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  studentProfile StudentProfile @relation(fields: [studentProfileId], references: [id], onDelete: Cascade)
  subject        Subject?       @relation(fields: [subjectId], references: [id], onDelete: SetNull)
  planEntries    PlanEntry[]
}

model PlanEntry {
  id                  String    @id @default(cuid())
  studentProfileId    String
  date                DateTime // UTC-midnight-anchored calendar date
  taskId              String?
  goalId              String?
  subjectId           String?
  title               String
  estimatedMinutes    Int
  checkInStatus       String    @default("pending") // "pending" | "done" | "partial" | "not_done"
  carriedOverFromDate DateTime?
  createdAt           DateTime  @default(now())

  studentProfile StudentProfile @relation(fields: [studentProfileId], references: [id], onDelete: Cascade)
  task           Task?          @relation(fields: [taskId], references: [id], onDelete: SetNull)
  goal           Goal?          @relation(fields: [goalId], references: [id], onDelete: SetNull)
  subject        Subject?       @relation(fields: [subjectId], references: [id], onDelete: SetNull)

  @@index([studentProfileId, date])
}
```

In the existing `StudentProfile` model, add two lines to its relations block (alongside the existing `goals Goal[]` line etc.):
```prisma
  tasks               Task[]
  planEntries         PlanEntry[]
```

In the existing `Subject` model, add two lines to its relations block (alongside the existing `timetableEntries TimetableEntry[]` line):
```prisma
  tasks            Task[]
  planEntries      PlanEntry[]
```

In the existing `Goal` model, add one line to its relations block (alongside `studentProfile`):
```prisma
  planEntries PlanEntry[]
```

- [ ] **Step 2: Run the migration**

Run: `npx prisma migrate dev --name add_task_and_plan_entry`
Expected: creates a new migration folder under `prisma/migrations/`, applies it to `prisma/dev.db`, regenerates the Prisma client. No errors.

- [ ] **Step 3: Write the failing smoke test**

`tests/lib/db/taskPlanSchema.test.ts`:
```typescript
import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import bcrypt from "bcryptjs";

describe("Task and PlanEntry schema", () => {
  const testEmail = `task-plan-schema-${Date.now()}@example.test`;
  let studentProfileId: string;

  afterAll(async () => {
    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    if (user) await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  });

  it("creates a user and student profile to attach tasks to", async () => {
    const passwordHash = await bcrypt.hash("schema-test-password", 12);
    const user = await prisma.user.create({ data: { email: testEmail, passwordHash, emailVerified: new Date() } });
    const profile = await prisma.studentProfile.create({
      data: {
        userId: user.id,
        name: "Schema Test",
        dateOfBirth: new Date("2008-01-01"),
        grade: "12",
        schoolName: "Test High",
        curriculum: "Test Board",
        academicYear: "2026-2027",
        timezone: "UTC",
      },
    });
    studentProfileId = profile.id;
    expect(studentProfileId).toBeTruthy();
  });

  it("creates and reads back a Task", async () => {
    const task = await prisma.task.create({
      data: {
        studentProfileId,
        title: "Finish algebra worksheet",
        dueDate: new Date("2026-11-01"),
        estimatedMinutes: 45,
      },
    });
    const found = await prisma.task.findUnique({ where: { id: task.id } });
    expect(found?.title).toBe("Finish algebra worksheet");
    expect(found?.status).toBe("open");
  });

  it("creates and reads back a PlanEntry linked to that Task", async () => {
    const task = await prisma.task.findFirstOrThrow({ where: { studentProfileId } });
    const entry = await prisma.planEntry.create({
      data: {
        studentProfileId,
        date: new Date("2026-11-01"),
        taskId: task.id,
        title: task.title,
        estimatedMinutes: task.estimatedMinutes,
      },
    });
    const found = await prisma.planEntry.findUnique({ where: { id: entry.id } });
    expect(found?.checkInStatus).toBe("pending");
    expect(found?.taskId).toBe(task.id);
  });
});
```

- [ ] **Step 4: Run the test and verify it fails**

Run: `npx vitest run tests/lib/db/taskPlanSchema.test.ts`
Expected: FAIL — `Property 'task' does not exist` (or similar) if Step 1–2 weren't done yet; if you did Steps 1–2 first (schema changes must exist before this test can even type-check), run this as your confirmation step instead and expect PASS. Either order is fine as long as you observe a real RED before the GREEN in Step 2's migration or this test — if the migration already succeeded, delete the generated Prisma client's types mentally and just confirm the test currently fails if you comment out the schema additions, OR simply proceed if you've already done Steps 1–2 in order and this is your first run (then Step 4 and Step 5 collapse into one PASS run, which is acceptable here since the "RED" state is "the models don't exist yet," already covered by Step 2 not having run).

- [ ] **Step 5: Run the test and verify it passes**

Run: `npx vitest run tests/lib/db/taskPlanSchema.test.ts`
Expected: PASS (3/3)

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations tests/lib/db/taskPlanSchema.test.ts
git commit -m "feat: add Task and PlanEntry schema for the daily core loop"
```

---

### Task 2: Task CRUD library

**Files:**
- Create: `src/lib/tasks/tasks.ts`
- Test: `tests/lib/tasks/tasks.test.ts`

**Interfaces:**
- Consumes: `getCurrentSessionUser()` from `@/lib/auth/session` (Phase 1), `prisma` from `@/lib/db/prisma` (Phase 1).
- Produces: `listTasks(): Promise<TaskView[]>`, `createTask(input: CreateTaskInput): Promise<{success: boolean; error?: string}>`, `updateTask(taskId: string, changes: Partial<CreateTaskInput>): Promise<{success: boolean; error?: string}>`, `deleteTask(taskId: string): Promise<{success: boolean; error?: string}>`, `markTaskDone(taskId: string): Promise<{success: boolean; error?: string}>` — all from `@/lib/tasks/tasks`, used by Task 5's `/tasks` page and Task 4's plan service.

- [ ] **Step 1: Write failing tests**

`tests/lib/tasks/tasks.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    studentProfile: { findUnique: vi.fn() },
    task: { findMany: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    planEntry: { updateMany: vi.fn() },
  },
}));
vi.mock("@/lib/auth/session", () => ({ getCurrentSessionUser: vi.fn() }));

import { prisma } from "@/lib/db/prisma";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { listTasks, createTask, updateTask, deleteTask, markTaskDone } from "@/lib/tasks/tasks";

const sessionUser = { id: "u1", email: "s@example.test", emailVerified: new Date() };
const profile = { id: "p1", userId: "u1" };

describe("listTasks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an empty list with no session", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(null);
    expect(await listTasks()).toEqual([]);
  });

  it("returns only the signed-in student's tasks", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.task.findMany as any).mockResolvedValue([{ id: "t1", title: "Essay" }]);
    const result = await listTasks();
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { studentProfileId: "p1" } }),
    );
    expect(result).toEqual([{ id: "t1", title: "Essay" }]);
  });
});

describe("createTask", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a blank title without touching the database", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    const result = await createTask({ title: "  ", estimatedMinutes: 30 });
    expect(result.success).toBe(false);
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it("rejects a non-positive estimated duration", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    const result = await createTask({ title: "Essay", estimatedMinutes: 0 });
    expect(result.success).toBe(false);
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it("creates a task scoped to the signed-in student's profile", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.task.create as any).mockResolvedValue({ id: "t1" });
    const result = await createTask({ title: "Essay", estimatedMinutes: 30, dueDate: "2026-11-01" });
    expect(result.success).toBe(true);
    expect(prisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ studentProfileId: "p1", title: "Essay" }) }),
    );
  });
});

describe("updateTask / deleteTask / markTaskDone — cross-student protection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updateTask refuses to modify a task belonging to a different student", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.task.findUnique as any).mockResolvedValue({ id: "t1", studentProfileId: "someone-elses-profile" });
    const result = await updateTask("t1", { title: "Hijacked" });
    expect(result.success).toBe(false);
    expect(prisma.task.update).not.toHaveBeenCalled();
  });

  it("deleteTask refuses to delete a task belonging to a different student", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.task.findUnique as any).mockResolvedValue({ id: "t1", studentProfileId: "someone-elses-profile" });
    const result = await deleteTask("t1");
    expect(result.success).toBe(false);
    expect(prisma.task.delete).not.toHaveBeenCalled();
  });

  it("markTaskDone refuses a task belonging to a different student", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.task.findUnique as any).mockResolvedValue({ id: "t1", studentProfileId: "someone-elses-profile" });
    const result = await markTaskDone("t1");
    expect(result.success).toBe(false);
    expect(prisma.task.update).not.toHaveBeenCalled();
  });
});

describe("markTaskDone — plan entry sync", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks the task done and syncs any pending plan entries for it", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.task.findUnique as any).mockResolvedValue({ id: "t1", studentProfileId: "p1" });
    (prisma.task.update as any).mockResolvedValue({ id: "t1", status: "done" });
    const result = await markTaskDone("t1");
    expect(result.success).toBe(true);
    expect(prisma.task.update).toHaveBeenCalledWith({ where: { id: "t1" }, data: { status: "done" } });
    expect(prisma.planEntry.updateMany).toHaveBeenCalledWith({
      where: { taskId: "t1", checkInStatus: "pending" },
      data: { checkInStatus: "done" },
    });
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npx vitest run tests/lib/tasks/tasks.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/tasks/tasks.ts`:
```typescript
"use server";

import { prisma } from "@/lib/db/prisma";
import { getCurrentSessionUser } from "@/lib/auth/session";

export interface TaskView {
  id: string;
  title: string;
  subjectId: string | null;
  dueDate: Date | null;
  estimatedMinutes: number;
  status: string;
}

export interface CreateTaskInput {
  title: string;
  subjectId?: string;
  dueDate?: string;
  estimatedMinutes: number;
}

async function getOwnProfile() {
  const user = await getCurrentSessionUser();
  if (!user) return null;
  return prisma.studentProfile.findUnique({ where: { userId: user.id } });
}

export async function listTasks(): Promise<TaskView[]> {
  const profile = await getOwnProfile();
  if (!profile) return [];
  return prisma.task.findMany({
    where: { studentProfileId: profile.id },
    orderBy: { dueDate: "asc" },
  });
}

export async function createTask(input: CreateTaskInput): Promise<{ success: boolean; error?: string }> {
  if (!input.title.trim()) {
    return { success: false, error: "Title is required." };
  }
  if (!Number.isFinite(input.estimatedMinutes) || input.estimatedMinutes <= 0) {
    return { success: false, error: "Estimated minutes must be a positive number." };
  }

  const profile = await getOwnProfile();
  if (!profile) {
    return { success: false, error: "You must be signed in to add a task." };
  }

  await prisma.task.create({
    data: {
      studentProfileId: profile.id,
      title: input.title.trim(),
      subjectId: input.subjectId ?? null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      estimatedMinutes: input.estimatedMinutes,
    },
  });
  return { success: true };
}

async function assertOwnedTask(taskId: string, profileId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || task.studentProfileId !== profileId) {
    return null;
  }
  return task;
}

export async function updateTask(
  taskId: string,
  changes: Partial<CreateTaskInput>,
): Promise<{ success: boolean; error?: string }> {
  const profile = await getOwnProfile();
  if (!profile) {
    return { success: false, error: "You must be signed in to update a task." };
  }

  const task = await assertOwnedTask(taskId, profile.id);
  if (!task) {
    return { success: false, error: "Task not found." };
  }

  await prisma.task.update({
    where: { id: taskId },
    data: {
      ...(changes.title !== undefined && { title: changes.title.trim() }),
      ...(changes.subjectId !== undefined && { subjectId: changes.subjectId }),
      ...(changes.dueDate !== undefined && { dueDate: changes.dueDate ? new Date(changes.dueDate) : null }),
      ...(changes.estimatedMinutes !== undefined && { estimatedMinutes: changes.estimatedMinutes }),
    },
  });
  return { success: true };
}

export async function deleteTask(taskId: string): Promise<{ success: boolean; error?: string }> {
  const profile = await getOwnProfile();
  if (!profile) {
    return { success: false, error: "You must be signed in to delete a task." };
  }

  const task = await assertOwnedTask(taskId, profile.id);
  if (!task) {
    return { success: false, error: "Task not found." };
  }

  await prisma.task.delete({ where: { id: taskId } });
  return { success: true };
}

export async function markTaskDone(taskId: string): Promise<{ success: boolean; error?: string }> {
  const profile = await getOwnProfile();
  if (!profile) {
    return { success: false, error: "You must be signed in to update a task." };
  }

  const task = await assertOwnedTask(taskId, profile.id);
  if (!task) {
    return { success: false, error: "Task not found." };
  }

  await prisma.task.update({ where: { id: taskId }, data: { status: "done" } });
  await prisma.planEntry.updateMany({
    where: { taskId, checkInStatus: "pending" },
    data: { checkInStatus: "done" },
  });
  return { success: true };
}
```

- [ ] **Step 4: Run and verify pass**

Run: `npx vitest run tests/lib/tasks/tasks.test.ts`
Expected: PASS (9/9)

- [ ] **Step 5: Commit**

```bash
git add src/lib/tasks tests/lib/tasks
git commit -m "feat: add session-scoped task CRUD with plan-entry completion sync"
```

---

### Task 3: Plan generator (pure function)

**Files:**
- Create: `src/lib/plan/generatePlan.ts`
- Test: `tests/lib/plan/generatePlan.test.ts`

**Interfaces:**
- Consumes: nothing (pure function, no DB, no Phase 1 imports).
- Produces: `generatePlanEntries(input: GeneratePlanInput): GeneratedPlanEntry[]` from `@/lib/plan/generatePlan`, used by Task 4's `planService.ts`.

- [ ] **Step 1: Write failing tests**

`tests/lib/plan/generatePlan.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { generatePlanEntries } from "@/lib/plan/generatePlan";

describe("generatePlanEntries", () => {
  it("places carry-forward entries first, tagged with their origin date", () => {
    const yesterday = new Date("2026-11-01");
    const result = generatePlanEntries({
      capacityMinutes: 60,
      carryForward: [
        { taskId: "t1", subjectId: "s1", title: "Unfinished reading", estimatedMinutes: 40, fromDate: yesterday },
      ],
      openTasks: [],
      eligibleGoals: [],
    });
    expect(result).toEqual([
      {
        taskId: "t1",
        goalId: null,
        subjectId: "s1",
        title: "Unfinished reading",
        estimatedMinutes: 40,
        carriedOverFromDate: yesterday,
      },
    ]);
  });

  it("orders open tasks by due date, nulls last, without throwing", () => {
    const result = generatePlanEntries({
      capacityMinutes: 1000,
      carryForward: [],
      openTasks: [
        { id: "no-date", subjectId: null, title: "Someday task", dueDate: null, estimatedMinutes: 10 },
        { id: "later", subjectId: null, title: "Due later", dueDate: new Date("2026-12-01"), estimatedMinutes: 10 },
        { id: "sooner", subjectId: null, title: "Due sooner", dueDate: new Date("2026-11-05"), estimatedMinutes: 10 },
      ],
      eligibleGoals: [],
    });
    expect(result.map((e) => e.taskId)).toEqual(["sooner", "later", "no-date"]);
  });

  it("skips a task that doesn't fit but keeps placing smaller ones that do", () => {
    const result = generatePlanEntries({
      capacityMinutes: 50,
      carryForward: [],
      openTasks: [
        { id: "big", subjectId: null, title: "Big task", dueDate: new Date("2026-11-01"), estimatedMinutes: 60 },
        { id: "small", subjectId: null, title: "Small task", dueDate: new Date("2026-11-02"), estimatedMinutes: 30 },
      ],
      eligibleGoals: [],
    });
    expect(result.map((e) => e.taskId)).toEqual(["small"]);
  });

  it("never splits a single task's time across the result", () => {
    const result = generatePlanEntries({
      capacityMinutes: 45,
      carryForward: [],
      openTasks: [{ id: "t1", subjectId: null, title: "Task", dueDate: null, estimatedMinutes: 60 }],
      eligibleGoals: [],
    });
    expect(result).toEqual([]);
  });

  it("adds at most one goal-filler entry when capacity remains", () => {
    const result = generatePlanEntries({
      capacityMinutes: 100,
      carryForward: [],
      openTasks: [{ id: "t1", subjectId: "s1", title: "Task", dueDate: null, estimatedMinutes: 30 }],
      eligibleGoals: [
        { id: "g1", subjectId: "s2", description: "Ace the final" },
        { id: "g2", subjectId: "s3", description: "Second goal" },
      ],
    });
    const fillers = result.filter((e) => e.goalId !== null);
    expect(fillers).toHaveLength(1);
    expect(fillers[0]).toEqual({
      taskId: null,
      goalId: "g1",
      subjectId: "s2",
      title: "Study for: Ace the final",
      estimatedMinutes: 30,
      carriedOverFromDate: null,
    });
  });

  it("adds no goal-filler entry when there is no remaining capacity", () => {
    const result = generatePlanEntries({
      capacityMinutes: 30,
      carryForward: [],
      openTasks: [{ id: "t1", subjectId: null, title: "Task", dueDate: null, estimatedMinutes: 30 }],
      eligibleGoals: [{ id: "g1", subjectId: null, description: "Goal" }],
    });
    expect(result.filter((e) => e.goalId !== null)).toHaveLength(0);
  });

  it("returns an empty array for zero capacity", () => {
    const result = generatePlanEntries({
      capacityMinutes: 0,
      carryForward: [],
      openTasks: [{ id: "t1", subjectId: null, title: "Task", dueDate: null, estimatedMinutes: 10 }],
      eligibleGoals: [],
    });
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npx vitest run tests/lib/plan/generatePlan.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/plan/generatePlan.ts`:
```typescript
const GOAL_FILLER_MINUTES = 30;

export interface GeneratorTaskInput {
  id: string;
  subjectId: string | null;
  title: string;
  dueDate: Date | null;
  estimatedMinutes: number;
}

export interface GeneratorCarryForwardInput {
  taskId: string;
  subjectId: string | null;
  title: string;
  estimatedMinutes: number;
  fromDate: Date;
}

export interface GeneratorGoalInput {
  id: string;
  subjectId: string | null;
  description: string;
}

export interface GeneratedPlanEntry {
  taskId: string | null;
  goalId: string | null;
  subjectId: string | null;
  title: string;
  estimatedMinutes: number;
  carriedOverFromDate: Date | null;
}

export interface GeneratePlanInput {
  capacityMinutes: number;
  carryForward: GeneratorCarryForwardInput[];
  openTasks: GeneratorTaskInput[];
  eligibleGoals: GeneratorGoalInput[];
}

export function generatePlanEntries(input: GeneratePlanInput): GeneratedPlanEntry[] {
  const entries: GeneratedPlanEntry[] = [];
  let remaining = input.capacityMinutes;

  for (const candidate of input.carryForward) {
    if (candidate.estimatedMinutes <= remaining) {
      entries.push({
        taskId: candidate.taskId,
        goalId: null,
        subjectId: candidate.subjectId,
        title: candidate.title,
        estimatedMinutes: candidate.estimatedMinutes,
        carriedOverFromDate: candidate.fromDate,
      });
      remaining -= candidate.estimatedMinutes;
    }
  }

  const sortedTasks = [...input.openTasks].sort((a, b) => {
    if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });

  for (const task of sortedTasks) {
    if (task.estimatedMinutes <= remaining) {
      entries.push({
        taskId: task.id,
        goalId: null,
        subjectId: task.subjectId,
        title: task.title,
        estimatedMinutes: task.estimatedMinutes,
        carriedOverFromDate: null,
      });
      remaining -= task.estimatedMinutes;
    }
  }

  if (GOAL_FILLER_MINUTES <= remaining && input.eligibleGoals.length > 0) {
    const goal = input.eligibleGoals[0];
    entries.push({
      taskId: null,
      goalId: goal.id,
      subjectId: goal.subjectId,
      title: `Study for: ${goal.description}`,
      estimatedMinutes: GOAL_FILLER_MINUTES,
      carriedOverFromDate: null,
    });
  }

  return entries;
}
```

- [ ] **Step 4: Run and verify pass**

Run: `npx vitest run tests/lib/plan/generatePlan.test.ts`
Expected: PASS (7/7)

- [ ] **Step 5: Commit**

```bash
git add src/lib/plan/generatePlan.ts tests/lib/plan/generatePlan.test.ts
git commit -m "feat: add pure daily plan generator function"
```

---

### Task 4: Plan service — lazy generation, check-in, carry-forward

**Files:**
- Modify: `src/lib/validation/timetable.ts` (export `toMinutes`)
- Create: `src/lib/plan/planService.ts`
- Test: `tests/lib/plan/planService.test.ts`

**Interfaces:**
- Consumes: `generatePlanEntries` (Task 3), `getCurrentSessionUser` (Phase 1), `todayInTimezone` (Phase 1, `@/lib/validation/age`), `toMinutes` (this task, `@/lib/validation/timetable`), `prisma` (Phase 1).
- Produces: `getOrGeneratePlanForDate(): Promise<PlanDayView>`, `checkInPlanEntry(entryId: string, status: "done" | "partial" | "not_done"): Promise<{success: boolean; error?: string}>` from `@/lib/plan/planService`, used by Task 6's `/plan` page.

- [ ] **Step 1: Export `toMinutes`**

In `src/lib/validation/timetable.ts`, change:
```typescript
function toMinutes(time: string): number {
```
to:
```typescript
export function toMinutes(time: string): number {
```

- [ ] **Step 2: Write failing tests**

`tests/lib/plan/planService.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    studentProfile: { findUnique: vi.fn() },
    planEntry: { findMany: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    task: { findMany: vi.fn(), update: vi.fn() },
    goal: { findMany: vi.fn() },
    availabilityWindow: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/auth/session", () => ({ getCurrentSessionUser: vi.fn() }));

import { prisma } from "@/lib/db/prisma";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { getOrGeneratePlanForDate, checkInPlanEntry } from "@/lib/plan/planService";

const sessionUser = { id: "u1", email: "s@example.test", emailVerified: new Date() };
const profile = { id: "p1", userId: "u1", timezone: "UTC" };

describe("getOrGeneratePlanForDate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an empty plan with no session", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(null);
    const result = await getOrGeneratePlanForDate();
    expect(result.entries).toEqual([]);
    expect(result.capacityMinutes).toBe(0);
  });

  it("returns existing entries for today without regenerating", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.planEntry.findMany as any).mockResolvedValueOnce([{ id: "e1", title: "Existing entry" }]);
    const result = await getOrGeneratePlanForDate();
    expect(result.entries).toEqual([{ id: "e1", title: "Existing entry" }]);
    expect(prisma.planEntry.create).not.toHaveBeenCalled();
  });

  it("generates and persists entries for a day with zero existing entries and zero availability", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.planEntry.findMany as any)
      .mockResolvedValueOnce([]) // today's existing entries: none
      .mockResolvedValueOnce([]); // yesterday's entries for carry-forward: none
    (prisma.availabilityWindow.findMany as any).mockResolvedValue([]); // no availability this weekday
    (prisma.task.findMany as any).mockResolvedValue([]);
    (prisma.goal.findMany as any).mockResolvedValue([]);

    const result = await getOrGeneratePlanForDate();
    expect(result.capacityMinutes).toBe(0);
    expect(result.entries).toEqual([]);
    expect(prisma.planEntry.create).not.toHaveBeenCalled();
  });

  it("persists a generated entry built from an open task and real availability", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.planEntry.findMany as any).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    (prisma.availabilityWindow.findMany as any).mockResolvedValue([
      { dayOfWeek: 0, startTime: "17:00", endTime: "18:00" },
    ]);
    (prisma.task.findMany as any).mockResolvedValue([
      { id: "t1", subjectId: null, title: "Reading", dueDate: null, estimatedMinutes: 30 },
    ]);
    (prisma.goal.findMany as any).mockResolvedValue([]);
    (prisma.planEntry.create as any).mockResolvedValue({ id: "new-entry" });

    await getOrGeneratePlanForDate();
    expect(prisma.planEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ studentProfileId: "p1", taskId: "t1", estimatedMinutes: 30 }),
      }),
    );
  });
});

describe("checkInPlanEntry", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuses to update an entry belonging to a different student", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.planEntry.findUnique as any).mockResolvedValue({ id: "e1", studentProfileId: "someone-elses-profile" });
    const result = await checkInPlanEntry("e1", "done");
    expect(result.success).toBe(false);
    expect(prisma.planEntry.update).not.toHaveBeenCalled();
  });

  it("marks an entry done and syncs its task when it has one", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.planEntry.findUnique as any).mockResolvedValue({ id: "e1", studentProfileId: "p1", taskId: "t1" });
    const result = await checkInPlanEntry("e1", "done");
    expect(result.success).toBe(true);
    expect(prisma.planEntry.update).toHaveBeenCalledWith({ where: { id: "e1" }, data: { checkInStatus: "done" } });
    expect(prisma.task.update).toHaveBeenCalledWith({ where: { id: "t1" }, data: { status: "done" } });
  });

  it("marks an entry not_done without touching its task", async () => {
    (getCurrentSessionUser as any).mockResolvedValue(sessionUser);
    (prisma.studentProfile.findUnique as any).mockResolvedValue(profile);
    (prisma.planEntry.findUnique as any).mockResolvedValue({ id: "e1", studentProfileId: "p1", taskId: "t1" });
    const result = await checkInPlanEntry("e1", "not_done");
    expect(result.success).toBe(true);
    expect(prisma.planEntry.update).toHaveBeenCalledWith({ where: { id: "e1" }, data: { checkInStatus: "not_done" } });
    expect(prisma.task.update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run and verify failure**

Run: `npx vitest run tests/lib/plan/planService.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

`src/lib/plan/planService.ts`:
```typescript
"use server";

import { prisma } from "@/lib/db/prisma";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { todayInTimezone } from "@/lib/validation/age";
import { toMinutes } from "@/lib/validation/timetable";
import { generatePlanEntries } from "./generatePlan";

export interface PlanDayView {
  entries: unknown[];
  capacityMinutes: number;
}

async function getOwnProfile() {
  const user = await getCurrentSessionUser();
  if (!user) return null;
  return prisma.studentProfile.findUnique({ where: { userId: user.id } });
}

function previousDate(date: Date): Date {
  return new Date(date.getTime() - 24 * 60 * 60 * 1000);
}

export async function getOrGeneratePlanForDate(): Promise<PlanDayView> {
  const profile = await getOwnProfile();
  if (!profile) return { entries: [], capacityMinutes: 0 };

  const today = todayInTimezone(profile.timezone);

  const existing = await prisma.planEntry.findMany({
    where: { studentProfileId: profile.id, date: today },
  });
  if (existing.length > 0) {
    const capacity = await capacityForDate(profile.id, today);
    return { entries: existing, capacityMinutes: capacity };
  }

  const capacityMinutes = await capacityForDate(profile.id, today);

  const yesterday = previousDate(today);
  const yesterdayEntries = await prisma.planEntry.findMany({
    where: { studentProfileId: profile.id, date: yesterday },
  });
  const carryForward = yesterdayEntries
    .filter((e) => e.taskId && (e.checkInStatus === "partial" || e.checkInStatus === "not_done"))
    .map((e) => ({
      taskId: e.taskId as string,
      subjectId: e.subjectId,
      title: e.title,
      estimatedMinutes: e.estimatedMinutes,
      fromDate: yesterday,
    }));
  const carryForwardTaskIds = new Set(carryForward.map((c) => c.taskId));

  const openTasks = (
    await prisma.task.findMany({ where: { studentProfileId: profile.id, status: "open" } })
  ).filter((t) => !carryForwardTaskIds.has(t.id));

  const fourteenDaysOut = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
  const openTaskGoalIds = new Set(
    (await prisma.task.findMany({ where: { studentProfileId: profile.id, status: "open" } }))
      .map((t) => t.subjectId)
      .filter((id): id is string => !!id),
  );
  const eligibleGoals = (
    await prisma.goal.findMany({
      where: { studentProfileId: profile.id, examDate: { not: null, lte: fourteenDaysOut, gte: today } },
      orderBy: { examDate: "asc" },
    })
  ).filter((g) => !g.subjectId || !openTaskGoalIds.has(g.subjectId));

  const generated = generatePlanEntries({
    capacityMinutes,
    carryForward,
    openTasks: openTasks.map((t) => ({
      id: t.id,
      subjectId: t.subjectId,
      title: t.title,
      dueDate: t.dueDate,
      estimatedMinutes: t.estimatedMinutes,
    })),
    eligibleGoals: eligibleGoals.map((g) => ({ id: g.id, subjectId: g.subjectId, description: g.description })),
  });

  const created = [];
  for (const entry of generated) {
    const row = await prisma.planEntry.create({
      data: {
        studentProfileId: profile.id,
        date: today,
        taskId: entry.taskId,
        goalId: entry.goalId,
        subjectId: entry.subjectId,
        title: entry.title,
        estimatedMinutes: entry.estimatedMinutes,
        carriedOverFromDate: entry.carriedOverFromDate,
      },
    });
    created.push(row);
  }

  return { entries: created, capacityMinutes };
}

async function capacityForDate(studentProfileId: string, date: Date): Promise<number> {
  const windows = await prisma.availabilityWindow.findMany({
    where: { studentProfileId, dayOfWeek: date.getUTCDay() },
  });
  return windows.reduce((sum, w) => sum + (toMinutes(w.endTime) - toMinutes(w.startTime)), 0);
}

export async function checkInPlanEntry(
  entryId: string,
  status: "done" | "partial" | "not_done",
): Promise<{ success: boolean; error?: string }> {
  const profile = await getOwnProfile();
  if (!profile) {
    return { success: false, error: "You must be signed in." };
  }

  const entry = await prisma.planEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.studentProfileId !== profile.id) {
    return { success: false, error: "Plan entry not found." };
  }

  await prisma.planEntry.update({ where: { id: entryId }, data: { checkInStatus: status } });

  if (status === "done" && entry.taskId) {
    await prisma.task.update({ where: { id: entry.taskId }, data: { status: "done" } });
  }

  return { success: true };
}
```

- [ ] **Step 5: Run and verify pass**

Run: `npx vitest run tests/lib/plan/planService.test.ts`
Expected: PASS (7/7)

- [ ] **Step 6: Run the full suite to confirm the `toMinutes` export didn't break anything**

Run: `npx vitest run`
Expected: all tests PASS (no regressions in `timetable.test.ts` or elsewhere).

- [ ] **Step 7: Commit**

```bash
git add src/lib/validation/timetable.ts src/lib/plan/planService.ts tests/lib/plan/planService.test.ts
git commit -m "feat: add plan service with lazy generation and check-in"
```

---

### Task 5: `/tasks` page

**Files:**
- Create: `src/app/tasks/page.tsx`
- Create: `src/app/tasks/TaskList.tsx`
- Test: `tests/app/task-list.test.tsx`

**Interfaces:**
- Consumes: `getCurrentSessionUser` (Phase 1), `listTasks`/`createTask`/`deleteTask`/`markTaskDone` (Task 2), `prisma` (Phase 1, for loading the student's subjects to populate the subject dropdown).

- [ ] **Step 1: Write a failing component test**

`tests/app/task-list.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TaskList } from "@/app/tasks/TaskList";

vi.mock("@/lib/tasks/tasks", () => ({
  createTask: vi.fn(),
  deleteTask: vi.fn(),
  markTaskDone: vi.fn(),
}));

import { createTask, deleteTask, markTaskDone } from "@/lib/tasks/tasks";

const subjects = [{ id: "sub1", name: "Math" }];
const initialTasks = [
  { id: "t1", title: "Algebra worksheet", subjectId: "sub1", dueDate: null, estimatedMinutes: 30, status: "open" },
];

describe("TaskList", () => {
  it("adds a new task to the list on successful submit", async () => {
    (createTask as any).mockResolvedValue({ success: true });
    render(<TaskList initialTasks={initialTasks} subjects={subjects} />);

    fireEvent.change(screen.getByPlaceholderText(/task title/i), { target: { value: "Read chapter 4" } });
    fireEvent.change(screen.getByLabelText(/estimated minutes/i), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: /add task/i }));

    await waitFor(() => {
      expect(screen.getByText("Read chapter 4")).toBeInTheDocument();
    });
    expect(createTask).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Read chapter 4", estimatedMinutes: 20 }),
    );
  });

  it("removes a task from the list after deleting it", async () => {
    (deleteTask as any).mockResolvedValue({ success: true });
    render(<TaskList initialTasks={initialTasks} subjects={subjects} />);

    fireEvent.click(screen.getByRole("button", { name: /delete algebra worksheet/i }));

    await waitFor(() => {
      expect(screen.queryByText("Algebra worksheet")).not.toBeInTheDocument();
    });
  });

  it("marks a task done and reflects it in the UI", async () => {
    (markTaskDone as any).mockResolvedValue({ success: true });
    render(<TaskList initialTasks={initialTasks} subjects={subjects} />);

    fireEvent.click(screen.getByRole("button", { name: /mark algebra worksheet done/i }));

    await waitFor(() => {
      expect(markTaskDone).toHaveBeenCalledWith("t1");
    });
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npx vitest run tests/app/task-list.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Build the client component**

`src/app/tasks/TaskList.tsx`:
```tsx
"use client";

import { useState } from "react";
import { createTask, deleteTask, markTaskDone } from "@/lib/tasks/tasks";

interface TaskView {
  id: string;
  title: string;
  subjectId: string | null;
  dueDate: Date | string | null;
  estimatedMinutes: number;
  status: string;
}

interface Subject {
  id: string;
  name: string;
}

export function TaskList({ initialTasks, subjects }: { initialTasks: TaskView[]; subjects: Subject[] }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [dueDate, setDueDate] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const result = await createTask({
      title,
      subjectId: subjectId || undefined,
      dueDate: dueDate || undefined,
      estimatedMinutes,
    });
    if (!result.success) {
      setError(result.error ?? "Something went wrong.");
      return;
    }
    setTasks((prev) => [
      ...prev,
      { id: crypto.randomUUID(), title, subjectId: subjectId || null, dueDate: dueDate || null, estimatedMinutes, status: "open" },
    ]);
    setTitle("");
    setDueDate("");
    setEstimatedMinutes(30);
  }

  async function handleDelete(id: string, taskTitle: string) {
    const result = await deleteTask(id);
    if (result.success) {
      setTasks((prev) => prev.filter((t) => t.id !== id));
    }
  }

  async function handleDone(id: string) {
    const result = await markTaskDone(id);
    if (result.success) {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: "done" } : t)));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleAdd} className="flex flex-col gap-3 rounded-xl bg-white p-6 shadow-sm">
        <input
          placeholder="Task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="rounded-lg border border-lavender px-4 py-2"
        />
        <select
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          className="rounded-lg border border-lavender px-4 py-2"
        >
          <option value="">No subject</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="rounded-lg border border-lavender px-4 py-2"
        />
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Estimated minutes
          <input
            type="number"
            min={1}
            value={estimatedMinutes}
            onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
            className="rounded-lg border border-lavender px-4 py-2"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="self-start rounded-full bg-pink px-6 py-2 font-medium text-white hover:bg-pink-dark">
          Add task
        </button>
      </form>

      <ul className="flex flex-col gap-2">
        {tasks.map((task) => (
          <li key={task.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
            <span className={task.status === "done" ? "text-slate-400 line-through" : ""}>{task.title}</span>
            <div className="flex gap-2">
              {task.status !== "done" && (
                <button
                  onClick={() => handleDone(task.id)}
                  aria-label={`Mark ${task.title} done`}
                  className="rounded-full bg-lavender px-3 py-1 text-sm text-white"
                >
                  Done
                </button>
              )}
              <button
                onClick={() => handleDelete(task.id, task.title)}
                aria-label={`Delete ${task.title}`}
                className="rounded-full border border-lavender px-3 py-1 text-sm text-lavender-dark"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run and verify pass**

Run: `npx vitest run tests/app/task-list.test.tsx`
Expected: PASS (3/3)

- [ ] **Step 5: Build the server page**

`src/app/tasks/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { listTasks } from "@/lib/tasks/tasks";
import { TaskList } from "./TaskList";

export default async function TasksPage() {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/login");

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
    include: { subjects: true },
  });
  if (!profile) redirect("/onboarding");

  const tasks = await listTasks();

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mb-8 text-2xl font-semibold text-pink-dark">Your tasks</h1>
      <TaskList initialTasks={tasks} subjects={profile.subjects} />
    </main>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/tasks tests/app/task-list.test.tsx
git commit -m "feat: add /tasks page with add, delete, and mark-done"
```

---

### Task 6: `/plan` page

**Files:**
- Create: `src/app/plan/page.tsx`
- Create: `src/app/plan/PlanView.tsx`
- Test: `tests/app/plan-view.test.tsx`

**Interfaces:**
- Consumes: `getCurrentSessionUser` (Phase 1), `getOrGeneratePlanForDate`/`checkInPlanEntry` (Task 4).

- [ ] **Step 1: Write a failing component test**

`tests/app/plan-view.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PlanView } from "@/app/plan/PlanView";

vi.mock("@/lib/plan/planService", () => ({ checkInPlanEntry: vi.fn() }));
import { checkInPlanEntry } from "@/lib/plan/planService";

const entries = [
  { id: "e1", title: "Algebra worksheet", estimatedMinutes: 30, checkInStatus: "pending", carriedOverFromDate: null },
];

describe("PlanView", () => {
  it("shows an explicit message when there is no availability and no entries", () => {
    render(<PlanView entries={[]} capacityMinutes={0} />);
    expect(screen.getByText(/no study time set for today/i)).toBeInTheDocument();
  });

  it("marks an entry done and updates its displayed status", async () => {
    (checkInPlanEntry as any).mockResolvedValue({ success: true });
    render(<PlanView entries={entries} capacityMinutes={60} />);

    fireEvent.click(screen.getByRole("button", { name: /mark algebra worksheet done/i }));

    await waitFor(() => {
      expect(checkInPlanEntry).toHaveBeenCalledWith("e1", "done");
    });
  });

  it("shows a carried-over badge for entries carried from a previous day", () => {
    const carried = [{ ...entries[0], carriedOverFromDate: new Date("2026-11-01") }];
    render(<PlanView entries={carried} capacityMinutes={60} />);
    expect(screen.getByText(/carried over/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npx vitest run tests/app/plan-view.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Build the client component**

`src/app/plan/PlanView.tsx`:
```tsx
"use client";

import { useState } from "react";
import { checkInPlanEntry } from "@/lib/plan/planService";

interface PlanEntryView {
  id: string;
  title: string;
  estimatedMinutes: number;
  checkInStatus: string;
  carriedOverFromDate: Date | string | null;
}

export function PlanView({ entries: initial, capacityMinutes }: { entries: PlanEntryView[]; capacityMinutes: number }) {
  const [entries, setEntries] = useState(initial);

  async function handleCheckIn(id: string, status: "done" | "partial" | "not_done") {
    const result = await checkInPlanEntry(id, status);
    if (result.success) {
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, checkInStatus: status } : e)));
    }
  }

  if (entries.length === 0 && capacityMinutes === 0) {
    return (
      <p className="rounded-xl bg-blush p-4 text-sm text-slate-700">
        No study time set for today. Add your weekly availability in your profile to get a personalized plan.
      </p>
    );
  }

  if (entries.length === 0) {
    return <p className="text-slate-500">No tasks or study blocks for today — you&apos;re all caught up.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {entries.map((entry) => (
        <li key={entry.id} className="rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className={entry.checkInStatus === "done" ? "text-slate-400 line-through" : ""}>{entry.title}</p>
              <p className="text-xs text-slate-500">{entry.estimatedMinutes} min</p>
              {entry.carriedOverFromDate && <p className="text-xs text-lavender-dark">Carried over from yesterday</p>}
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => handleCheckIn(entry.id, "done")}
                aria-label={`Mark ${entry.title} done`}
                className="rounded-full bg-lavender px-3 py-1 text-xs text-white"
              >
                Done
              </button>
              <button
                onClick={() => handleCheckIn(entry.id, "partial")}
                aria-label={`Mark ${entry.title} partial`}
                className="rounded-full border border-lavender px-3 py-1 text-xs text-lavender-dark"
              >
                Partial
              </button>
              <button
                onClick={() => handleCheckIn(entry.id, "not_done")}
                aria-label={`Mark ${entry.title} not done`}
                className="rounded-full border border-lavender px-3 py-1 text-xs text-lavender-dark"
              >
                Not done
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Run and verify pass**

Run: `npx vitest run tests/app/plan-view.test.tsx`
Expected: PASS (3/3)

- [ ] **Step 5: Build the server page**

`src/app/plan/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getOrGeneratePlanForDate } from "@/lib/plan/planService";
import { PlanView } from "./PlanView";

export default async function PlanPage() {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/login");

  const profile = await prisma.studentProfile.findUnique({ where: { userId: user.id } });
  if (!profile) redirect("/onboarding");

  const { entries, capacityMinutes } = await getOrGeneratePlanForDate();

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mb-8 text-2xl font-semibold text-pink-dark">Today&apos;s plan</h1>
      <PlanView entries={entries as any} capacityMinutes={capacityMinutes} />
    </main>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/plan tests/app/plan-view.test.tsx
git commit -m "feat: add /plan page with inline check-in"
```

---

### Task 7: Dashboard integration

**Files:**
- Modify: `src/app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `listTasks` (Task 2), `getOrGeneratePlanForDate` (Task 4).

- [ ] **Step 1: Replace the placeholder sections with real summaries**

In `src/app/dashboard/page.tsx`, the current code (from Phase 1) ends with a loop rendering four placeholder `<section>` blocks for `["Study plan", "Homework & tasks", "Daily check-in", "Progress reports"]`. Replace the `"Study plan"` and `"Homework & tasks"` entries with real summary cards; leave `"Daily check-in"` and `"Progress reports"` as honest placeholders (check-in is folded into `/plan` per this phase's design — a dedicated placeholder card for it would be misleading now that it exists, so remove `"Daily check-in"` from the placeholder list entirely; `"Progress reports"` stays, since that's genuinely Phase 3).

Replace:
```tsx
      {(["Study plan", "Homework & tasks", "Daily check-in", "Progress reports"] as const).map((label) => (
        <section key={label} className="mb-4 rounded-xl border border-dashed border-lavender p-6 text-slate-500">
          {label} is coming in a later phase.
        </section>
      ))}
```
with:
```tsx
      <section className="mb-4 rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-medium text-lavender-dark">Today&apos;s plan</h2>
        <p className="text-slate-600">
          {planEntryCount === 0
            ? "No study time set for today — check your availability in your profile."
            : `${planDoneCount} of ${planEntryCount} items done.`}
        </p>
        <Link href="/plan" className="mt-2 inline-block text-sm text-lavender-dark underline">
          View today&apos;s plan
        </Link>
      </section>

      <section className="mb-4 rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-medium text-lavender-dark">Homework &amp; tasks</h2>
        <p className="text-slate-600">{openTaskCount} open task{openTaskCount === 1 ? "" : "s"}.</p>
        <Link href="/tasks" className="mt-2 inline-block text-sm text-lavender-dark underline">
          Manage tasks
        </Link>
      </section>

      <section className="mb-4 rounded-xl border border-dashed border-lavender p-6 text-slate-500">
        Progress reports is coming in a later phase.
      </section>
```

Add the two new imports at the top of the file:
```tsx
import { listTasks } from "@/lib/tasks/tasks";
import { getOrGeneratePlanForDate } from "@/lib/plan/planService";
```

And compute the three new values before the `return` statement, alongside the existing `profile`/`banner` lookups:
```tsx
  const tasks = await listTasks();
  const openTaskCount = tasks.filter((t) => t.status === "open").length;
  const { entries: planEntries } = await getOrGeneratePlanForDate();
  const planEntryCount = planEntries.length;
  const planDoneCount = (planEntries as { checkInStatus: string }[]).filter((e) => e.checkInStatus === "done").length;
```

A dedicated `tests/app/dashboard-plan-summary.test.tsx` isn't practical without a full integration harness (the dashboard page is an async server component reading the real session + database, which Phase 1's dashboard has no existing component-level test for either — it was never unit-tested directly, only exercised via the underlying `bannerState` unit tests). No dedicated test file for this task; correctness is confirmed through Task 8's manual smoke test (which specifically checks the dashboard's plan/task counts), and the underlying data functions this step only composes and renders are already covered by `tasks.test.ts` (Task 2) and `planService.test.ts` (Task 4).

- [ ] **Step 2: Run the full suite and confirm nothing broke**

Run: `npx vitest run`
Expected: all tests PASS — this change only touches the dashboard page, which has no dedicated test file, so no new failures should appear; a failure here means something in the edit broke an import or type elsewhere.

- [ ] **Step 3: Run `tsc` to confirm the new page code type-checks**

Run: `npx tsc --noEmit`
Expected: clean, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: replace dashboard plan/task placeholders with real summaries"
```

---

### Task 8: Final integration pass

**Files:**
- None created — verification only.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests PASS (Phase 1's suite plus every test added in Tasks 1–6 of this plan).

- [ ] **Step 2: Run a production build**

Run: `npm run build`
Expected: builds without type errors; `/tasks` and `/plan` appear in the route list as dynamic (`ƒ`) routes (they read the session on every request, like `/dashboard` and `/profile`).

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`, then in the browser (using an already-onboarded test account from Phase 1, or completing onboarding fresh):
1. Visit `/tasks`. Add a task with a subject, a due date a few days out, and an estimated duration. Confirm it appears in the list.
2. Add a second task with no due date and no subject. Confirm it still saves (both are optional).
3. Visit `/plan`. Confirm a plan was generated: if you set up availability windows during onboarding, confirm your tasks appear, ordered with the dated one before the no-date one if both fit; if you set zero availability, confirm the "No study time set for today" message appears instead of a blank page.
4. Mark one plan entry "Partial" and another "Done". Reload `/plan` — confirm the statuses persisted (not regenerated/reset).
5. Visit `/tasks` and confirm the task behind the "Done" plan entry now shows as done there too (sync works both directions).
6. Visit `/dashboard`. Confirm the "Today's plan" and "Homework & tasks" cards show real counts matching what you just did, and link correctly to `/plan` and `/tasks`.
7. (Optional, requires waiting a day or manually adjusting system clock/test data) Confirm a "Partial" entry's task reappears on `/plan` the next day with a "Carried over from yesterday" label.

- [ ] **Step 4: Commit (if the manual smoke test required any fixes)**

```bash
git add -A
git commit -m "fix: address issues found in Phase 2 manual smoke test"
```

(Skip this step entirely if the smoke test found nothing to fix.)
