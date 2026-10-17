import { describe, it, expect } from "vitest";
import { getPlanDayStatus } from "@/lib/plan/planDayStatus";

describe("getPlanDayStatus", () => {
  it("returns no-availability when there are no entries and zero capacity", () => {
    expect(getPlanDayStatus(0, 0)).toBe("no-availability");
  });

  it("returns caught-up when there are no entries but some capacity", () => {
    expect(getPlanDayStatus(0, 1)).toBe("caught-up");
  });

  it("returns in-progress when there is at least one entry, regardless of capacity", () => {
    expect(getPlanDayStatus(1, 0)).toBe("in-progress");
    expect(getPlanDayStatus(1, 60)).toBe("in-progress");
  });
});
