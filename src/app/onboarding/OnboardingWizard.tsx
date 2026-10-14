"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { completeOnboarding, type OnboardingInput } from "@/lib/onboarding/completeOnboarding";

const STEPS = ["Basics", "Subjects", "Timetable", "Availability", "Goals", "Reminders"] as const;

export function OnboardingWizard({ userId }: { userId: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState<Omit<OnboardingInput, "userId">>({
    name: "",
    dateOfBirth: "",
    grade: "",
    schoolName: "",
    curriculum: "",
    academicYear: "",
    gender: undefined,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    subjects: [],
    timetable: [],
    availability: [],
    goals: [],
    reminderChannel: "none",
    preferredTimes: [],
    phone: undefined,
    guardian: undefined,
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleFinish() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await completeOnboarding({ userId, ...form });
      if (result.success) {
        router.push("/dashboard");
      } else {
        setError(result.error ?? "Something went wrong.");
        setSubmitting(false);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  const isMinor = form.dateOfBirth
    ? new Date().getFullYear() - new Date(form.dateOfBirth).getFullYear() < 19 // rough client-side hint only; the server re-checks the exact rule
    : false;

  const basicsComplete =
    form.name.trim() !== "" &&
    form.dateOfBirth !== "" &&
    form.grade.trim() !== "" &&
    form.schoolName.trim() !== "" &&
    form.curriculum.trim() !== "" &&
    form.academicYear.trim() !== "";
  const guardianComplete = !isMinor || (!!form.guardian?.name.trim() && !!form.guardian?.email.trim());
  const canLeaveStep0 = basicsComplete && guardianComplete;
  const canProceed = step === 0 ? canLeaveStep0 : true;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="mb-8 flex gap-2">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`h-1 flex-1 rounded-full ${i <= step ? "bg-pink" : "bg-blush"}`}
          />
        ))}
      </div>
      <h1 className="mb-6 text-2xl font-semibold text-pink-dark">{STEPS[step]}</h1>

      {step === 0 && (
        <div className="flex flex-col gap-4">
          <input
            placeholder="Your name"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            className="rounded-lg border border-lavender px-4 py-2"
          />
          <input
            type="date"
            value={form.dateOfBirth}
            onChange={(e) => update("dateOfBirth", e.target.value)}
            className="rounded-lg border border-lavender px-4 py-2"
          />
          <input
            placeholder="Grade / class"
            value={form.grade}
            onChange={(e) => update("grade", e.target.value)}
            className="rounded-lg border border-lavender px-4 py-2"
          />
          <input
            placeholder="School name"
            value={form.schoolName}
            onChange={(e) => update("schoolName", e.target.value)}
            className="rounded-lg border border-lavender px-4 py-2"
          />
          <input
            placeholder="Curriculum (e.g. CBSE, IB, State Board)"
            value={form.curriculum}
            onChange={(e) => update("curriculum", e.target.value)}
            className="rounded-lg border border-lavender px-4 py-2"
          />
          <input
            placeholder="Academic year (e.g. 2026-2027)"
            value={form.academicYear}
            onChange={(e) => update("academicYear", e.target.value)}
            className="rounded-lg border border-lavender px-4 py-2"
          />
          <select
            value={form.gender ?? ""}
            onChange={(e) => update("gender", e.target.value || undefined)}
            className="rounded-lg border border-lavender px-4 py-2"
          >
            <option value="">Prefer not to say</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="nonbinary">Non-binary</option>
          </select>
          {isMinor && (
            <div className="rounded-lg bg-blush p-4">
              <p className="mb-2 text-sm text-slate-600">
                Since you may be under 18, we need a guardian&apos;s name and email to approve your account.
              </p>
              <input
                placeholder="Guardian name"
                value={form.guardian?.name ?? ""}
                onChange={(e) => update("guardian", { name: e.target.value, email: form.guardian?.email ?? "" })}
                className="mb-2 w-full rounded-lg border border-lavender px-4 py-2"
              />
              <input
                placeholder="Guardian email"
                value={form.guardian?.email ?? ""}
                onChange={(e) => update("guardian", { name: form.guardian?.name ?? "", email: e.target.value })}
                className="w-full rounded-lg border border-lavender px-4 py-2"
              />
            </div>
          )}
        </div>
      )}

      {step === 1 && (
        <SubjectStep subjects={form.subjects} onChange={(subjects) => update("subjects", subjects)} />
      )}

      {step === 2 && (
        <TimetableStep
          subjects={form.subjects}
          entries={form.timetable}
          onChange={(timetable) => update("timetable", timetable)}
        />
      )}

      {step === 3 && (
        <AvailabilityStep
          entries={form.availability}
          onChange={(availability) => update("availability", availability)}
        />
      )}

      {step === 4 && (
        <GoalsStep subjects={form.subjects} goals={form.goals} onChange={(goals) => update("goals", goals)} />
      )}

      {step === 5 && (
        <ReminderStep
          channel={form.reminderChannel}
          preferredTimes={form.preferredTimes}
          phone={form.phone}
          onChannelChange={(c) => update("reminderChannel", c)}
          onTimesChange={(t) => update("preferredTimes", t)}
          onPhoneChange={(p) => update("phone", p)}
        />
      )}

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-8 flex justify-between">
        <button
          disabled={step === 0}
          onClick={() => setStep((s) => s - 1)}
          className="rounded-full border border-lavender px-6 py-2 text-lavender-dark disabled:opacity-40"
        >
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canProceed}
            className="rounded-full bg-pink px-6 py-2 font-medium text-white hover:bg-pink-dark disabled:opacity-40"
          >
            Next
          </button>
        ) : (
          <button
            onClick={handleFinish}
            disabled={submitting || !canProceed}
            className="rounded-full bg-pink px-6 py-2 font-medium text-white hover:bg-pink-dark disabled:opacity-60"
          >
            {submitting ? "Saving..." : "Finish"}
          </button>
        )}
      </div>
      {step === 0 && !canProceed && (
        <p className="mt-2 text-right text-xs text-slate-500">
          {!basicsComplete
            ? "Fill in all the basics above to continue."
            : "A guardian name and email are required for students under 18."}
        </p>
      )}
    </main>
  );
}

function SubjectStep({ subjects, onChange }: { subjects: string[]; onChange: (s: string[]) => void }) {
  const [draft, setDraft] = useState("");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a subject"
          className="flex-1 rounded-lg border border-lavender px-4 py-2"
        />
        <button
          type="button"
          onClick={() => {
            if (draft.trim()) {
              onChange([...subjects, draft.trim()]);
              setDraft("");
            }
          }}
          className="rounded-lg bg-lavender px-4 py-2 text-white"
        >
          Add
        </button>
      </div>
      <ul className="flex flex-wrap gap-2">
        {subjects.map((s) => (
          <li key={s} className="rounded-full bg-blush px-3 py-1 text-sm">
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TimetableStep({
  subjects,
  entries,
  onChange,
}: {
  subjects: string[];
  entries: OnboardingInput["timetable"];
  onChange: (e: OnboardingInput["timetable"]) => void;
}) {
  const [draft, setDraft] = useState({ dayOfWeek: 1, subjectName: subjects[0] ?? "", startTime: "09:00", endTime: "10:00" });
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        <select
          value={draft.dayOfWeek}
          onChange={(e) => setDraft({ ...draft, dayOfWeek: Number(e.target.value) })}
          className="rounded-lg border border-lavender px-4 py-2"
        >
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
            <option key={d} value={i}>{d}</option>
          ))}
        </select>
        <select
          value={draft.subjectName}
          onChange={(e) => setDraft({ ...draft, subjectName: e.target.value })}
          className="rounded-lg border border-lavender px-4 py-2"
        >
          {subjects.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input
          type="time"
          value={draft.startTime}
          onChange={(e) => setDraft({ ...draft, startTime: e.target.value })}
          className="rounded-lg border border-lavender px-4 py-2"
        />
        <input
          type="time"
          value={draft.endTime}
          onChange={(e) => setDraft({ ...draft, endTime: e.target.value })}
          className="rounded-lg border border-lavender px-4 py-2"
        />
      </div>
      <button
        type="button"
        onClick={() => onChange([...entries, draft])}
        className="self-start rounded-lg bg-lavender px-4 py-2 text-white"
      >
        Add period
      </button>
      <ul className="flex flex-col gap-1 text-sm">
        {entries.map((e, i) => (
          <li key={i}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][e.dayOfWeek]} {e.startTime}-{e.endTime} {e.subjectName}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AvailabilityStep({
  entries,
  onChange,
}: {
  entries: OnboardingInput["availability"];
  onChange: (e: OnboardingInput["availability"]) => void;
}) {
  const [draft, setDraft] = useState({ dayOfWeek: 1, startTime: "17:00", endTime: "19:00" });
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600">When are you free to study at home?</p>
      <div className="grid grid-cols-2 gap-2">
        <select
          value={draft.dayOfWeek}
          onChange={(e) => setDraft({ ...draft, dayOfWeek: Number(e.target.value) })}
          className="rounded-lg border border-lavender px-4 py-2"
        >
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
            <option key={d} value={i}>{d}</option>
          ))}
        </select>
        <input
          type="time"
          value={draft.startTime}
          onChange={(e) => setDraft({ ...draft, startTime: e.target.value })}
          className="rounded-lg border border-lavender px-4 py-2"
        />
        <input
          type="time"
          value={draft.endTime}
          onChange={(e) => setDraft({ ...draft, endTime: e.target.value })}
          className="rounded-lg border border-lavender px-4 py-2"
        />
      </div>
      <button
        type="button"
        onClick={() => onChange([...entries, draft])}
        className="self-start rounded-lg bg-lavender px-4 py-2 text-white"
      >
        Add window
      </button>
    </div>
  );
}

function GoalsStep({
  subjects,
  goals,
  onChange,
}: {
  subjects: string[];
  goals: OnboardingInput["goals"];
  onChange: (g: OnboardingInput["goals"]) => void;
}) {
  const [draft, setDraft] = useState({ description: "", examDate: "", subjectName: subjects[0] ?? "" });
  return (
    <div className="flex flex-col gap-4">
      <input
        placeholder="Study goal (e.g. Score 90% in Math)"
        value={draft.description}
        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        className="rounded-lg border border-lavender px-4 py-2"
      />
      <input
        type="date"
        value={draft.examDate}
        onChange={(e) => setDraft({ ...draft, examDate: e.target.value })}
        className="rounded-lg border border-lavender px-4 py-2"
      />
      <button
        type="button"
        onClick={() => {
          if (draft.description.trim()) {
            onChange([...goals, draft]);
            setDraft({ description: "", examDate: "", subjectName: subjects[0] ?? "" });
          }
        }}
        className="self-start rounded-lg bg-lavender px-4 py-2 text-white"
      >
        Add goal
      </button>
      <ul className="text-sm">
        {goals.map((g, i) => (
          <li key={i}>{g.description}{g.examDate ? ` (by ${g.examDate})` : ""}</li>
        ))}
      </ul>
    </div>
  );
}

function ReminderStep({
  channel,
  preferredTimes,
  phone,
  onChannelChange,
  onTimesChange,
  onPhoneChange,
}: {
  channel: OnboardingInput["reminderChannel"];
  preferredTimes: string[];
  phone?: string;
  onChannelChange: (c: OnboardingInput["reminderChannel"]) => void;
  onTimesChange: (t: string[]) => void;
  onPhoneChange: (p: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <select
        value={channel}
        onChange={(e) => onChannelChange(e.target.value as OnboardingInput["reminderChannel"])}
        className="rounded-lg border border-lavender px-4 py-2"
      >
        <option value="none">No reminders for now</option>
        <option value="browser">Browser notifications</option>
        <option value="email">Email</option>
        <option value="whatsapp">WhatsApp</option>
      </select>
      <input
        type="time"
        value={preferredTimes[0] ?? ""}
        onChange={(e) => onTimesChange([e.target.value])}
        className="rounded-lg border border-lavender px-4 py-2"
      />
      {channel === "whatsapp" && (
        <input
          placeholder="Phone number (with country code)"
          value={phone ?? ""}
          onChange={(e) => onPhoneChange(e.target.value)}
          className="rounded-lg border border-lavender px-4 py-2"
        />
      )}
      <p className="text-xs text-slate-500">
        WhatsApp delivery isn&apos;t wired up yet — that arrives in a later phase. Your preference is saved either way.
      </p>
    </div>
  );
}
