import Link from "next/link";
import { LandingHeader } from "./LandingHeader";

const FEATURES = [
  {
    title: "Daily study plan",
    desc: "Every day, Study Reminder turns your open tasks and availability into a realistic plan — not a wish list.",
  },
  {
    title: "Homework & tasks",
    desc: "Track assignments by subject and due date. Unfinished work carries forward instead of quietly disappearing.",
  },
  {
    title: "Daily check-ins",
    desc: "Mark each plan item done, partial, or not done. Honest status beats a fake streak.",
  },
  {
    title: "Study reminders",
    desc: "A dashboard built to answer one question at a glance: what needs your attention today.",
  },
  {
    title: "Journal",
    desc: "A private, dated log of how studying actually went — separate from the numbers.",
  },
  {
    title: "Progress & streaks",
    desc: "Daily completion, planned-vs-actual time by subject, and a check-in streak — built from your real activity, never invented.",
  },
];

const FAQS = [
  {
    q: "Is Study Reminder free to use?",
    a: "Yes. Create a student account and start planning — no payment required.",
  },
  {
    q: "Does it work on mobile?",
    a: "Yes. The dashboard, tasks, journal, and progress pages are all responsive and usable on a phone or tablet.",
  },
  {
    q: "Who can see my study data?",
    a: "Only you. Every page is scoped to your own signed-in account, and students under 18 require guardian consent during signup.",
  },
  {
    q: "What if I don't finish a task on time?",
    a: "Unfinished tasks carry forward to the next day's plan automatically — nothing is silently dropped.",
  },
];

export default function Home() {
  return (
    <div>
      <LandingHeader />

      <main>
        <section className="mx-auto max-w-6xl px-4 py-16 lg:px-8 lg:py-24">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
            <div>
              <h1 className="text-4xl font-semibold leading-tight text-ink lg:text-5xl">
                Stay on top of every subject, every day.
              </h1>
              <p className="mt-5 max-w-xl text-lg text-ink-muted">
                Study Reminder turns your subjects, tasks, and availability into a daily plan —
                then tracks what actually got done, honestly.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link href="/signup" className="rounded-full bg-brand px-6 py-3 font-medium text-white shadow-sm transition hover:bg-brand-dark">
                  Start planning
                </Link>
                <a href="#features" className="rounded-full border border-border px-6 py-3 font-medium text-ink transition hover:border-brand hover:text-brand">
                  Explore features
                </a>
              </div>
            </div>

            <DashboardPreview />
          </div>
        </section>

        <section id="features" className="border-t border-border bg-white px-4 py-16 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-2xl font-semibold text-ink lg:text-3xl">Everything your study routine actually needs</h2>
            <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div key={f.title} className="rounded-xl border border-border p-6">
                  <h3 className="text-base font-semibold text-ink">{f.title}</h3>
                  <p className="mt-2 text-sm text-ink-muted">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="px-4 py-16 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-2xl font-semibold text-ink lg:text-3xl">How it works</h2>
            <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-3">
              {[
                { step: "1", title: "Set up your profile", desc: "Add your subjects, school details, and weekly study availability." },
                { step: "2", title: "Get a daily plan", desc: "Study Reminder schedules your open tasks into the time you actually have." },
                { step: "3", title: "Check in honestly", desc: "Mark each item done, partial, or not done — your progress reflects reality." },
              ].map((s) => (
                <div key={s.step} className="text-center">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white">
                    {s.step}
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-ink">{s.title}</h3>
                  <p className="mt-2 text-sm text-ink-muted">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="border-t border-border bg-white px-4 py-16 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-2xl font-semibold text-ink lg:text-3xl">Frequently asked questions</h2>
            <div className="mt-10 flex flex-col divide-y divide-border">
              {FAQS.map((item) => (
                <details key={item.q} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-ink">
                    {item.q}
                    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0 text-ink-muted transition group-open:rotate-180">
                      <path d="M5 7.5l5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </summary>
                  <p className="mt-2 text-sm text-ink-muted">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 text-center lg:px-8 lg:py-24">
          <h2 className="text-2xl font-semibold text-ink lg:text-3xl">Ready to plan your day?</h2>
          <p className="mx-auto mt-3 max-w-md text-ink-muted">Create a free account and get your first study plan in minutes.</p>
          <Link href="/signup" className="mt-8 inline-block rounded-full bg-brand px-8 py-3 font-medium text-white shadow-sm transition hover:bg-brand-dark">
            Create your account
          </Link>
        </section>
      </main>

      <footer className="border-t border-border bg-white px-4 py-10 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-xs font-bold text-white">SR</span>
            <span className="text-sm font-semibold text-ink">Study Reminder</span>
          </div>
          <nav className="flex gap-6 text-sm text-ink-muted" aria-label="Footer navigation">
            <a href="#features" className="hover:text-ink">Features</a>
            <a href="#how-it-works" className="hover:text-ink">How it works</a>
            <a href="#faq" className="hover:text-ink">FAQ</a>
            <Link href="/login" className="hover:text-ink">Sign in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function DashboardPreview() {
  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-sm lg:p-5" aria-hidden="true">
      <div className="mb-4 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-danger/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-warning/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
      </div>
      <div className="grid grid-cols-4 gap-3">
        <div className="col-span-1 flex flex-col gap-2 rounded-lg bg-surface-page p-2">
          {["Dashboard", "Study plan", "Tasks", "Journal", "Progress"].map((label, i) => (
            <div key={label} className={`rounded px-2 py-1.5 text-[10px] font-medium ${i === 0 ? "bg-brand-light text-brand" : "text-ink-muted"}`}>
              {label}
            </div>
          ))}
        </div>
        <div className="col-span-3 flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2">
            {["3/5", "4", "6"].map((v, i) => (
              <div key={i} className="rounded-lg border border-border p-2">
                <div className="h-1.5 w-8 rounded bg-surface-page" />
                <p className="mt-1.5 text-sm font-semibold text-ink">{v}</p>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-border p-3">
            <div className="mb-2 h-2 w-20 rounded bg-surface-page" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="mb-2 flex items-center justify-between">
                <div className="h-2 w-24 rounded bg-surface-page" />
                <div className={`h-4 w-10 rounded-full ${i === 1 ? "bg-success-light" : "bg-surface-page"}`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
