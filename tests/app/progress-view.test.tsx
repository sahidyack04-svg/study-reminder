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

  it("re-fetches data when the Month toggle is clicked", async () => {
    (getProgressData as any).mockResolvedValue(activeData);
    render(<ProgressView initialWindow="week" initialData={emptyData} streak={0} />);

    fireEvent.click(screen.getByRole("button", { name: /month/i }));

    await waitFor(() => {
      expect(getProgressData).toHaveBeenCalledWith("month");
    });
  });
});
