"use client";

import { useState } from "react";
import { createTask, updateTask, deleteTask, markTaskDone } from "@/lib/tasks/tasks";

interface TaskView {
  id: string;
  title: string;
  subjectId: string | null;
  dueDate: Date | string | null;
  estimatedMinutes: number;
  status: string;
}

interface Subject {
  id: string;
  name: string;
}

export function TaskList({ initialTasks, subjects }: { initialTasks: TaskView[]; subjects: Subject[] }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [dueDate, setDueDate] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editEstimatedMinutes, setEditEstimatedMinutes] = useState(30);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const result = await createTask({
      title,
      subjectId: subjectId || undefined,
      dueDate: dueDate || undefined,
      estimatedMinutes,
    });
    if (!result.success || !result.task) {
      setError(result.error ?? "Something went wrong.");
      return;
    }
    setTasks((prev) => [...prev, result.task!]);
    setTitle("");
    setDueDate("");
    setEstimatedMinutes(30);
  }

  async function handleDelete(id: string) {
    setError(null);
    const result = await deleteTask(id);
    if (result.success) {
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } else {
      setError(result.error ?? "Something went wrong.");
    }
  }

  async function handleDone(id: string) {
    setError(null);
    const result = await markTaskDone(id);
    if (result.success) {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: "done" } : t)));
    } else {
      setError(result.error ?? "Something went wrong.");
    }
  }

  function startEdit(task: TaskView) {
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditEstimatedMinutes(task.estimatedMinutes);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id: string) {
    setError(null);
    const result = await updateTask(id, { title: editTitle, estimatedMinutes: editEstimatedMinutes });
    if (result.success) {
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, title: editTitle, estimatedMinutes: editEstimatedMinutes } : t)),
      );
      setEditingId(null);
    } else {
      setError(result.error ?? "Something went wrong.");
    }
  }

  const fieldClass =
    "w-full rounded-lg border border-border bg-surface px-3 py-2 text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40";

  return (
    <div className="flex animate-fade-up flex-col gap-6">
      <form onSubmit={handleAdd} className="panel-cosmic-raised flex flex-col gap-3 p-6">
        <input
          placeholder="Task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className={fieldClass}
        />
        <select
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          className={fieldClass}
        >
          <option value="">No subject</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className={`${fieldClass} [color-scheme:dark]`}
        />
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Estimated minutes
          <input
            type="number"
            min={1}
            value={estimatedMinutes}
            onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
            className={fieldClass}
          />
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="submit"
          className="self-start rounded-lg bg-brand px-4 py-2 font-semibold text-cosmic-void shadow-glow transition hover:bg-brand-dark"
        >
          Add task
        </button>
      </form>

      <ul className="flex flex-col gap-2">
        {tasks.map((task) =>
          editingId === task.id ? (
            <li key={task.id} className="panel-cosmic-raised flex flex-col gap-2 p-4">
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className={fieldClass}
              />
              <label className="flex flex-col gap-1 text-sm font-medium text-ink">
                Estimated minutes
                <input
                  type="number"
                  min={1}
                  value={editEstimatedMinutes}
                  onChange={(e) => setEditEstimatedMinutes(Number(e.target.value))}
                  className={fieldClass}
                />
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => saveEdit(task.id)}
                  className="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-cosmic-void shadow-glow transition hover:bg-brand-dark"
                >
                  Save changes
                </button>
                <button
                  onClick={cancelEdit}
                  className="rounded-lg border border-border px-4 py-1.5 text-sm font-medium text-ink transition hover:border-brand hover:text-brand"
                >
                  Cancel
                </button>
              </div>
            </li>
          ) : (
            <li
              key={task.id}
              className="panel-cosmic glow-interactive flex items-center justify-between gap-3 p-4"
            >
              <span
                className={
                  task.status === "done"
                    ? "min-w-0 text-sm text-ink-faint line-through"
                    : "min-w-0 text-sm font-medium text-ink"
                }
              >
                {task.title}
              </span>
              <div className="flex shrink-0 gap-2">
                {task.status !== "done" && (
                  <button
                    onClick={() => handleDone(task.id)}
                    aria-label={`Mark ${task.title} done`}
                    className="rounded-lg border border-success/30 bg-success-light px-3 py-1.5 text-sm font-medium text-success transition hover:border-success/60"
                  >
                    Done
                  </button>
                )}
                <button
                  onClick={() => startEdit(task)}
                  aria-label={`Edit ${task.title}`}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-ink transition hover:border-brand hover:text-brand"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(task.id)}
                  aria-label={`Delete ${task.title}`}
                  className="rounded-lg border border-danger/30 px-3 py-1.5 text-sm font-medium text-danger transition hover:bg-danger-light"
                >
                  Delete
                </button>
              </div>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
