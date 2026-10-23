"use client";

import { useState } from "react";
import Link from "next/link";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#faq", label: "FAQ" },
];

export function LandingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">SR</span>
          <span className="text-base font-semibold text-ink">Study Reminder</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Site navigation">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="text-sm font-medium text-ink-muted transition hover:text-ink">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link href="/login" className="text-sm font-medium text-ink-muted transition hover:text-ink">
            Sign in
          </Link>
          <Link href="/signup" className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark">
            Create account
          </Link>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg p-2 text-ink-muted hover:bg-surface-page md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
            {open ? (
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            ) : (
              <path d="M3 5.5h14M3 10h14M3 14.5h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-white px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-3" aria-label="Site navigation">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} onClick={() => setOpen(false)} className="text-sm font-medium text-ink-muted">
                {link.label}
              </a>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
              <Link href="/login" onClick={() => setOpen(false)} className="text-sm font-medium text-ink-muted">
                Sign in
              </Link>
              <Link
                href="/signup"
                onClick={() => setOpen(false)}
                className="rounded-full bg-brand px-4 py-2 text-center text-sm font-medium text-white"
              >
                Create account
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
