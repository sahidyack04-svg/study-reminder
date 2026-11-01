import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { TestsView } from "@/app/(app)/tests/TestsView";

vi.mock("next/navigation", () => ({ useRouter: vi.fn() }));
vi.mock("@/lib/assessments/testService", () => ({ startTest: vi.fn() }));
import { startTest } from "@/lib/assessments/testService";

const subjects = [{ id: "sub1", name: "Math" }];
const pastTests = [
  {
    id: "t1",
    subjectId: "sub1",
    subjectName: "Math",
    status: "completed" as const,
    scorePercent: 80,
    createdAt: new Date("2026-10-01"),
    completedAt: new Date("2026-10-01"),
  },
];

describe("TestsView", () => {
  it("shows an honest message when there are not enough attempts for any weak topic yet", () => {
    render(<TestsView subjects={subjects} initialTests={pastTests} weakTopics={[]} />);
    expect(screen.getByText(/not enough data yet/i)).toBeInTheDocument();
  });

  it("lists weak topics with their wrong rate when there is enough data", () => {
    render(
      <TestsView
        subjects={subjects}
        initialTests={pastTests}
        weakTopics={[{ topic: "Fractions", attempts: 4, wrongRate: 75 }]}
      />,
    );
    expect(screen.getByText(/fractions/i)).toBeInTheDocument();
    expect(screen.getByText(/75/)).toBeInTheDocument();
  });

  it("shows past test history with subject and score", () => {
    render(<TestsView subjects={subjects} initialTests={pastTests} weakTopics={[]} />);
    expect(screen.getByRole("link", { name: /math/i })).toBeInTheDocument();
    expect(screen.getByText(/80/)).toBeInTheDocument();
  });

  it("shows an empty-history message when there are no past tests", () => {
    render(<TestsView subjects={subjects} initialTests={[]} weakTopics={[]} />);
    expect(screen.getByText(/no tests yet/i)).toBeInTheDocument();
  });

  it("starts a new test and navigates to it", async () => {
    const push = vi.fn();
    (useRouter as any).mockReturnValue({ push });
    (startTest as any).mockResolvedValue({ success: true, testId: "t2" });
    render(<TestsView subjects={subjects} initialTests={[]} weakTopics={[]} />);

    fireEvent.click(screen.getByRole("button", { name: /start/i }));

    await waitFor(() => {
      expect(startTest).toHaveBeenCalledWith("sub1", expect.any(Number));
      expect(push).toHaveBeenCalledWith("/tests/t2");
    });
  });

  it("surfaces an error instead of navigating when starting a test fails", async () => {
    (useRouter as any).mockReturnValue({ push: vi.fn() });
    (startTest as any).mockResolvedValue({ success: false, error: "This subject has no questions yet." });
    render(<TestsView subjects={subjects} initialTests={[]} weakTopics={[]} />);

    fireEvent.click(screen.getByRole("button", { name: /start/i }));

    await waitFor(() => {
      expect(screen.getByText(/no questions yet/i)).toBeInTheDocument();
    });
  });
});
