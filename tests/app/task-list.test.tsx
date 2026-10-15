import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TaskList } from "@/app/tasks/TaskList";

vi.mock("@/lib/tasks/tasks", () => ({
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  markTaskDone: vi.fn(),
}));

import { createTask, updateTask, deleteTask, markTaskDone } from "@/lib/tasks/tasks";

const subjects = [{ id: "sub1", name: "Math" }];
const initialTasks = [
  { id: "t1", title: "Algebra worksheet", subjectId: "sub1", dueDate: null, estimatedMinutes: 30, status: "open" },
];

describe("TaskList", () => {
  beforeEach(() => vi.clearAllMocks());

  it("adds a new task to the list on successful submit", async () => {
    (createTask as any).mockResolvedValue({
      success: true,
      task: { id: "new-task-id", title: "Read chapter 4", subjectId: null, dueDate: null, estimatedMinutes: 20, status: "open" },
    });
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

  it("edits a task's title and estimated minutes via the inline edit form", async () => {
    (updateTask as any).mockResolvedValue({ success: true });
    render(<TaskList initialTasks={initialTasks} subjects={subjects} />);

    fireEvent.click(screen.getByRole("button", { name: /edit algebra worksheet/i }));

    const titleInput = screen.getByDisplayValue("Algebra worksheet");
    fireEvent.change(titleInput, { target: { value: "Algebra worksheet (revised)" } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByText("Algebra worksheet (revised)")).toBeInTheDocument();
    });
    expect(updateTask).toHaveBeenCalledWith(
      "t1",
      expect.objectContaining({ title: "Algebra worksheet (revised)" }),
    );
  });

  it("cancels an edit without calling updateTask", async () => {
    render(<TaskList initialTasks={initialTasks} subjects={subjects} />);

    fireEvent.click(screen.getByRole("button", { name: /edit algebra worksheet/i }));
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.getByText("Algebra worksheet")).toBeInTheDocument();
    expect(updateTask).not.toHaveBeenCalled();
  });
});
