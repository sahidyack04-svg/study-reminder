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
    if (!result.success) {
      setError(result.error ?? "Something went wrong.");
      return;
    }
    setTasks((prev) => [
      ...prev,
      { id: crypto.randomUUID(), title, subjectId: subjectId || null, dueDate: dueDate || null, estimatedMinutes, status: "open" },
    ]);
    setTitle("");
    setDueDate("");
    setEstimatedMinutes(30);
  }

  async function handleDelete(id: string) {
    const result = await deleteTask(id);
    if (result.success) {
      setTasks((prev) => prev.filter((t) => t.id !== id));
    }
  }

  async function handleDone(id: string) {
    const result = await markTaskDone(id);
    if (result.success) {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: "done" } : t)));
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
    const result = await updateTask(id, { title: editTitle, estimatedMinutes: editEstimatedMinutes });
    if (result.success) {
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, title: editTitle, estimatedMinutes: editEstimatedMinutes } : t)),
      );
      setEditingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleAdd} className="flex flex-col gap-3 rounded-xl bg-white p-6 shadow-sm">
        <input
          placeholder="Task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="rounded-lg border border-lavender px-4 py-2"
        />
        <select
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          className="rounded-lg border border-lavender px-4 py-2"
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
          className="rounded-lg border border-lavender px-4 py-2"
        />
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Estimated minutes
          <input
            type="number"
            min={1}
            value={estimatedMinutes}
            onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
            className="rounded-lg border border-lavender px-4 py-2"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="self-start rounded-full bg-pink px-6 py-2 font-medium text-white hover:bg-pink-dark">
          Add task
        </button>
      </form>

      <ul className="flex flex-col gap-2">
        {tasks.map((task) =>
          editingId === task.id ? (
            <li key={task.id} className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-sm">
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="rounded-lg border border-lavender px-4 py-2"
              />
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Estimated minutes
                <input
                  type="number"
                  min={1}
                  value={editEstimatedMinutes}
                  onChange={(e) => setEditEstimatedMinutes(Number(e.target.value))}
                  className="rounded-lg border border-lavender px-4 py-2"
                />
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => saveEdit(task.id)}
                  className="rounded-full bg-pink px-4 py-1 text-sm font-medium text-white"
                >
                  Save changes
                </button>
                <button
                  onClick={cancelEdit}
                  className="rounded-full border border-lavender px-4 py-1 text-sm text-lavender-dark"
                >
                  Cancel
                </button>
              </div>
            </li>
          ) : (
            <li key={task.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
              <span className={task.status === "done" ? "text-slate-400 line-through" : ""}>{task.title}</span>
              <div className="flex gap-2">
                {task.status !== "done" && (
                  <button
                    onClick={() => handleDone(task.id)}
                    aria-label={`Mark ${task.title} done`}
                    className="rounded-full bg-lavender px-3 py-1 text-sm text-white"
                  >
                    Done
                  </button>
                )}
                <button
                  onClick={() => startEdit(task)}
                  aria-label={`Edit ${task.title}`}
                  className="rounded-full border border-lavender px-3 py-1 text-sm text-lavender-dark"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(task.id)}
                  aria-label={`Delete ${task.title}`}
                  className="rounded-full border border-lavender px-3 py-1 text-sm text-lavender-dark"
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
