import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProgressView } from "@/app/progress/ProgressView";

vi.mock("@/lib/progress/progressService", () => ({ getProgressData: vi.fn() }));
import { getProgressData } from "@/lib/progress/progressService";

const activeData = {
  completion: [{ date: new Date("2026-10-17"), percentDone: 75 }],
  subjectTime: [{ subjectId: "s1", subjectName: "Math", plannedMinutes: 60, actualMinutes: 45 }],
  hasActivity: true,
};

const emptyData = { completion: [], subjectTime: [], hasActivity: false };

describe("ProgressView", () => {
  it("shows an honest empty-state message when there is no activity", () => {
    render(<ProgressView initialWindow="week" initialData={emptyData} streak={0} />);
    expect(screen.getByText(/no study activity yet/i)).toBeInTheDocument();
  });

  it("renders the completion and subject-time charts when activity exists", () => {
    render(<ProgressView initialWindow="week" initialData={activeData} streak={3} />);
    expect(screen.getAllByText(/math/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/3/)).toBeInTheDocument();
  });

  it("keeps bars within the chart's visible bounds and shows a numeric label on every bar, even when actual exceeds planned", () => {
    const overAchieved = {
      completion: [],
      subjectTime: [{ subjectId: "s1", subjectName: "Math", plannedMinutes: 30, actualMinutes: 90 }],
      hasActivity: true,
    };
    const { container } = render(<ProgressView initialWindow="week" initialData={overAchieved} streak={0} />);

    const rects = Array.from(container.querySelectorAll("svg rect"));
    expect(rects.length).toBeGreaterThan(0);
    for (const rect of rects) {
      const y = Number(rect.getAttribute("y"));
      const height = Number(rect.getAttribute("height"));
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y + height).toBeLessThanOrEqual(140.01);
    }

    const svgTexts = Array.from(container.querySelectorAll("svg text")).map((t) => t.textContent);
    expect(svgTexts).toContain("30");
    expect(svgTexts).toContain("90");
  });

  it("re-fetches data when the Month toggle is clicked", async () => {
    (getProgressData as any).mockResolvedValue(activeData);
    render(<ProgressView initialWindow="week" initialData={emptyData} streak={0} />);

    fireEvent.click(screen.getByRole("button", { name: /month/i }));

    await waitFor(() => {
      expect(getProgressData).toHaveBeenCalledWith("month");
    });
  });
});
