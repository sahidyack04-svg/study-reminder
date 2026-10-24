import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActivityCalendar } from "@/app/(app)/progress/ActivityCalendar";

describe("ActivityCalendar", () => {
  it("renders a filled cell for a day with activity and an empty cell for a day with none", () => {
    const data = [
      { date: new Date("2026-10-23"), percentDone: 100 },
      { date: new Date("2026-10-24"), percentDone: 0 },
    ];
    const { container } = render(<ActivityCalendar data={data} />);
    const filled = container.querySelector('[data-testid="activity-cell-2026-10-23"]');
    const emptyDay = container.querySelector('[data-testid="activity-cell-2026-10-22"]');
    expect(filled?.getAttribute("data-has-activity")).toBe("true");
    expect(emptyDay).toBeNull();
  });

  it("shows an honest message instead of an empty grid when there is no activity at all", () => {
    render(<ActivityCalendar data={[]} />);
    expect(screen.getByText(/no activity yet/i)).toBeInTheDocument();
  });
});
