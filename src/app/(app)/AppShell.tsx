"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

interface NavItem {
  href: string;
  label: string;
  icon: (props: { className?: string }) => React.ReactNode;
}

function IconDashboard({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <rect x="2.5" y="2.5" width="6.5" height="6.5" rx="1.25" stroke="currentColor" strokeWidth="1.6" />
      <rect x="11" y="2.5" width="6.5" height="4" rx="1.25" stroke="currentColor" strokeWidth="1.6" />
      <rect x="11" y="8.5" width="6.5" height="9" rx="1.25" stroke="currentColor" strokeWidth="1.6" />
      <rect x="2.5" y="11" width="6.5" height="6.5" rx="1.25" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconPlan({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <rect x="2.5" y="3.5" width="15" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2.5 7.5h15" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6.5 2v3M13.5 2v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M5.5 11h3M11.5 11h3M5.5 14h3M11.5 14h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconTasks({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M3.5 5.5l1.5 1.5 2.5-2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 5h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M3.5 10.5l1.5 1.5 2.5-2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 10h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M3.5 15.5l1.5 1.5 2.5-2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 15h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconJournal({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M4 3.5h9A1.5 1.5 0 0 1 14.5 5v12.5H5.5A1.5 1.5 0 0 1 4 16V3.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14.5 5H16a0.5 0.5 0 0 1 .5.5V16a1.5 1.5 0 0 1-1.5 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M7 7.5h4.5M7 10.5h4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconProgress({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M3 17V3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M3 17h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="5.5" y="10" width="2.3" height="5" rx="0.6" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9.3" y="6.5" width="2.3" height="8.5" rx="0.6" stroke="currentColor" strokeWidth="1.5" />
      <rect x="13.1" y="8.5" width="2.3" height="6.5" rx="0.6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconProfile({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.75 17a6.25 6.25 0 0 1 12.5 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: IconDashboard },
  { href: "/plan", label: "Study plan", icon: IconPlan },
  { href: "/tasks", label: "Tasks & homework", icon: IconTasks },
  { href: "/journal", label: "Journal", icon: IconJournal },
  { href: "/progress", label: "Progress", icon: IconProgress },
  { href: "/profile", label: "Account", icon: IconProfile },
];

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1" aria-label="Main navigation">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
              active ? "bg-brand-light text-brand" : "text-ink-muted hover:bg-surface-page hover:text-ink"
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ studentName, children }: { studentName: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const currentLabel = NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(item.href + "/"))?.label ?? "Study Reminder";

  return (
    <div className="min-h-screen bg-surface-page">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow-md">
        Skip to content
      </a>

      <div className="mx-auto flex max-w-7xl">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-white px-4 py-6 lg:flex">
          <Link href="/dashboard" className="mb-8 flex items-center gap-2 px-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">SR</span>
            <span className="text-base font-semibold text-ink">Study Reminder</span>
          </Link>
          <NavLinks pathname={pathname} />
          <div className="mt-auto flex flex-col gap-1 border-t border-border pt-4">
            <p className="truncate px-3 text-sm font-medium text-ink">{studentName}</p>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="rounded-lg px-3 py-2 text-left text-sm text-ink-muted transition hover:bg-surface-page hover:text-ink"
            >
              Sign out
            </button>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-border bg-white px-4 py-3 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileNavOpen(true)}
                className="rounded-lg p-2 text-ink-muted hover:bg-surface-page lg:hidden"
                aria-label="Open navigation menu"
              >
                <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
                  <path d="M3 5.5h14M3 10h14M3 14.5h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
              <h1 className="text-base font-semibold text-ink">{currentLabel}</h1>
            </div>
            <Link href="/profile" className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-light text-sm font-semibold text-brand lg:hidden">
              {studentName.charAt(0).toUpperCase()}
            </Link>
          </header>

          <main id="main-content" className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
            <div className="mx-auto max-w-5xl">{children}</div>
          </main>
        </div>
      </div>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setMobileNavOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white px-4 py-6 shadow-xl">
            <div className="mb-8 flex items-center justify-between px-2">
              <span className="text-base font-semibold text-ink">Study Reminder</span>
              <button onClick={() => setMobileNavOpen(false)} aria-label="Close navigation menu" className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-page">
                <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
                  <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <NavLinks pathname={pathname} onNavigate={() => setMobileNavOpen(false)} />
            <div className="mt-auto flex flex-col gap-1 border-t border-border pt-4">
              <p className="truncate px-3 text-sm font-medium text-ink">{studentName}</p>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="rounded-lg px-3 py-2 text-left text-sm text-ink-muted transition hover:bg-surface-page hover:text-ink"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
