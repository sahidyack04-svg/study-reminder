import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center gap-8 px-6 py-24 text-center">
      <h1 className="text-4xl font-semibold text-pink-dark">Study Reminder</h1>
      <p className="max-w-xl text-lg text-slate-600">
        Your personal study companion — plan your day, track your homework,
        and stay on top of every subject.
      </p>
      <div className="flex gap-4">
        <Link
          href="/signup"
          className="rounded-full bg-pink px-6 py-3 font-medium text-white shadow-sm transition hover:bg-pink-dark"
        >
          Sign up
        </Link>
        <Link
          href="/login"
          className="rounded-full border border-lavender px-6 py-3 font-medium text-lavender-dark transition hover:bg-blush"
        >
          Log in
        </Link>
      </div>
    </main>
  );
}
