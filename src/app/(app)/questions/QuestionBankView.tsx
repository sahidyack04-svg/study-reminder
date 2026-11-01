"use client";

import { useState } from "react";
import { createQuestion, updateQuestion, deleteQuestion } from "@/lib/questions/questions";
import type { QuestionView } from "@/lib/questions/questions";

interface Subject {
  id: string;
  name: string;
}

type QuestionType = "mcq" | "short_answer";

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40";

export function QuestionBankView({
  subjects,
  initialQuestions,
}: {
  subjects: Subject[];
  initialQuestions: Record<string, QuestionView[]>;
}) {
  return (
    <div className="flex animate-fade-up flex-col gap-6">
      {subjects.length === 0 ? (
        <p className="rounded-lg border border-border bg-cosmic-deep/40 px-4 py-6 text-center text-sm text-ink-faint">
          No subjects yet — add your subjects in Account before building a question bank.
        </p>
      ) : (
        subjects.map((subject) => (
          <SubjectBank
            key={subject.id}
            subject={subject}
            initialQuestions={initialQuestions[subject.id] ?? []}
          />
        ))
      )}
    </div>
  );
}

function SubjectBank({ subject, initialQuestions }: { subject: Subject; initialQuestions: QuestionView[] }) {
  const [questions, setQuestions] = useState<QuestionView[]>(initialQuestions);
  const [error, setError] = useState<string | null>(null);

  const [prompt, setPrompt] = useState("");
  const [type, setType] = useState<QuestionType>("mcq");
  const [topic, setTopic] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [editTopic, setEditTopic] = useState("");
  const [editCorrectAnswer, setEditCorrectAnswer] = useState("");

  function resetForm() {
    setPrompt("");
    setTopic("");
    setCorrectAnswer("");
    setOptions(["", ""]);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const result = await createQuestion({
      subjectId: subject.id,
      topic,
      type,
      prompt,
      options: type === "mcq" ? options.filter((o) => o.trim() !== "") : [],
      correctAnswer,
    });
    if (!result.success || !result.question) {
      setError(result.error ?? "Something went wrong.");
      return;
    }
    setQuestions((prev) => [...prev, result.question!]);
    resetForm();
  }

  async function handleDelete(question: QuestionView) {
    setError(null);
    const result = await deleteQuestion(question.id);
    if (result.success) {
      setQuestions((prev) => prev.filter((q) => q.id !== question.id));
    } else {
      setError(result.error ?? "Something went wrong.");
    }
  }

  function startEdit(question: QuestionView) {
    setEditingId(question.id);
    setEditPrompt(question.prompt);
    setEditTopic(question.topic);
    setEditCorrectAnswer(question.correctAnswer);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(question: QuestionView) {
    setError(null);
    const result = await updateQuestion(question.id, {
      subjectId: question.subjectId,
      topic: editTopic,
      type: question.type,
      prompt: editPrompt,
      options: question.options,
      correctAnswer: editCorrectAnswer,
    });
    if (result.success) {
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === question.id
            ? { ...q, prompt: editPrompt, topic: editTopic, correctAnswer: editCorrectAnswer }
            : q,
        ),
      );
      setEditingId(null);
    } else {
      setError(result.error ?? "Something went wrong.");
    }
  }

  return (
    <section className="panel-cosmic flex flex-col gap-4 p-6">
      <h2 className="text-lg font-semibold text-ink">{subject.name}</h2>

      {questions.length === 0 ? (
        <p className="rounded-lg border border-border bg-cosmic-deep/40 px-4 py-6 text-center text-sm text-ink-faint">
          No questions yet for {subject.name} — add one to start building a test.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {questions.map((question) =>
            editingId === question.id ? (
              <li key={question.id} className="panel-cosmic flex flex-col gap-2 p-4">
                <label className="flex flex-col gap-1 text-sm font-medium text-ink">
                  Edit prompt
                  <input
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    className={fieldClass}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-ink">
                  Edit topic
                  <input
                    value={editTopic}
                    onChange={(e) => setEditTopic(e.target.value)}
                    className={fieldClass}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-ink">
                  Edit correct answer
                  <input
                    value={editCorrectAnswer}
                    onChange={(e) => setEditCorrectAnswer(e.target.value)}
                    className={fieldClass}
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => saveEdit(question)}
                    className="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-cosmic-void shadow-glow transition hover:bg-brand-dark"
                  >
                    Save changes
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="rounded-lg border border-border px-4 py-1.5 text-sm font-medium text-ink transition hover:border-brand hover:text-brand"
                  >
                    Cancel
                  </button>
                </div>
              </li>
            ) : (
              <li key={question.id} className="panel-cosmic glow-interactive flex flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{question.prompt}</p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {question.topic} · {question.type === "mcq" ? "Multiple choice" : "Short answer"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(question)}
                      aria-label={`Edit ${question.prompt}`}
                      className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-ink transition hover:border-brand hover:text-brand"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(question)}
                      aria-label={`Delete ${question.prompt}`}
                      className="rounded-lg border border-danger/30 px-3 py-1.5 text-sm font-medium text-danger transition hover:bg-danger-light"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {question.type === "mcq" && question.options.length > 0 && (
                  <ul className="flex flex-wrap gap-2">
                    {question.options.map((option, index) => (
                      <li
                        key={`${question.id}-option-${index}`}
                        className="rounded-lg border border-border bg-cosmic-deep/40 px-2 py-1 text-xs text-ink-muted"
                      >
                        {option}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-xs text-ink-faint">Answer: {question.correctAnswer}</p>
              </li>
            ),
          )}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-ink-muted">Add a question to {subject.name}</h3>
        <label htmlFor={`prompt-${subject.id}`} className="text-sm font-medium text-ink">
          Prompt
        </label>
        <input
          id={`prompt-${subject.id}`}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="What is 1/2 + 1/4?"
          required
          className={fieldClass}
        />

        <label htmlFor={`type-${subject.id}`} className="text-sm font-medium text-ink">
          Question type
        </label>
        <select
          id={`type-${subject.id}`}
          value={type}
          onChange={(e) => setType(e.target.value as QuestionType)}
          className={fieldClass}
        >
          <option value="mcq">Multiple choice</option>
          <option value="short_answer">Short answer</option>
        </select>

        <label htmlFor={`topic-${subject.id}`} className="text-sm font-medium text-ink">
          Topic
        </label>
        <input
          id={`topic-${subject.id}`}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Fractions"
          className={fieldClass}
        />

        <label htmlFor={`correct-answer-${subject.id}`} className="text-sm font-medium text-ink">
          Correct answer
        </label>
        <input
          id={`correct-answer-${subject.id}`}
          value={correctAnswer}
          onChange={(e) => setCorrectAnswer(e.target.value)}
          placeholder="3/4"
          className={fieldClass}
        />

        {type === "mcq" && (
          <div className="flex flex-col gap-2">
            {options.map((option, index) => (
              <div key={`new-option-${index}`} className="flex items-end gap-2">
                <div className="flex-1">
                  <label htmlFor={`option-${subject.id}-${index}`} className="text-sm font-medium text-ink">
                    Option {index + 1}
                  </label>
                  <input
                    id={`option-${subject.id}-${index}`}
                    value={option}
                    onChange={(e) =>
                      setOptions((prev) => prev.map((o, i) => (i === index ? e.target.value : o)))
                    }
                    className={fieldClass}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setOptions((prev) => prev.filter((_, i) => i !== index))}
                  aria-label={`Remove option ${index + 1}`}
                  className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-ink transition hover:border-brand hover:text-brand"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setOptions((prev) => [...prev, ""])}
              className="self-start rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-ink transition hover:border-brand hover:text-brand"
            >
              Add option
            </button>
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          className="self-start rounded-lg bg-brand px-4 py-2 font-semibold text-cosmic-void shadow-glow transition hover:bg-brand-dark"
        >
          Add question
        </button>
      </form>
    </section>
  );
}
