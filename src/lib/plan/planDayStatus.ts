export type PlanDayStatus = "no-availability" | "caught-up" | "in-progress";

export function getPlanDayStatus(entryCount: number, capacityMinutes: number): PlanDayStatus {
  if (entryCount === 0 && capacityMinutes === 0) return "no-availability";
  if (entryCount === 0) return "caught-up";
  return "in-progress";
}
