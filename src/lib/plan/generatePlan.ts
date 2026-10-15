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
