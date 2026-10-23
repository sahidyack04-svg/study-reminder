import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PlanView } from "@/app/(app)/plan/PlanView";

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

  it("shows an error message when checking in an entry fails", async () => {
    (checkInPlanEntry as any).mockResolvedValue({ success: false, error: "Plan entry not found." });
    render(<PlanView entries={entries} capacityMinutes={60} />);

    fireEvent.click(screen.getByRole("button", { name: /mark algebra worksheet done/i }));

    await waitFor(() => {
      expect(screen.getByText(/plan entry not found/i)).toBeInTheDocument();
    });
  });

  it("shows a different message when caught up with no entries but real availability", () => {
    render(<PlanView entries={[]} capacityMinutes={60} />);
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
    expect(screen.queryByText(/no study time set for today/i)).not.toBeInTheDocument();
  });
});
