"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/cosmic/Logo";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#faq", label: "FAQ" },
];

export function LandingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-cosmic-void/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 lg:px-8">
        <Link href="/" className="glow-interactive flex items-center gap-2 rounded-lg">
          <Logo size={32} />
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Site navigation">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="text-sm font-medium text-ink-muted transition hover:text-brand">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link href="/login" className="text-sm font-medium text-ink-muted transition hover:text-brand">
            Sign in
          </Link>
          <Link href="/signup" className="glow-interactive rounded-full bg-brand px-4 py-2 text-sm font-semibold text-cosmic-void shadow-glow transition hover:bg-brand-dark">
            Create account
          </Link>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="glow-interactive rounded-lg border border-border p-2 text-ink-muted hover:text-brand md:hidden"
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
        <div className="animate-fade-up border-t border-border bg-cosmic-void/90 px-4 py-4 backdrop-blur-md md:hidden">
          <nav className="flex flex-col gap-3" aria-label="Site navigation">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} onClick={() => setOpen(false)} className="text-sm font-medium text-ink-muted transition hover:text-brand">
                {link.label}
              </a>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
              <Link href="/login" onClick={() => setOpen(false)} className="text-sm font-medium text-ink-muted transition hover:text-brand">
                Sign in
              </Link>
              <Link
                href="/signup"
                onClick={() => setOpen(false)}
                className="glow-interactive rounded-full bg-brand px-4 py-2 text-center text-sm font-semibold text-cosmic-void shadow-glow"
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
