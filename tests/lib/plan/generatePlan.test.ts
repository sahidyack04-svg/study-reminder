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
