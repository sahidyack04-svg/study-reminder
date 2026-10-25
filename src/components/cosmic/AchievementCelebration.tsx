"use client";

import { useEffect, useState } from "react";
import type { Achievement } from "@/lib/progress/achievements";

const STORAGE_KEY = "sr-last-seen-longest-streak";

/**
 * Plays a one-time celebratory animation the first time this browser sees a new
 * achievement milestone crossed (tracked via localStorage, not a server round-trip -
 * this is a decorative frontend touch, not an audit trail). Falls back to a plain
 * status toast under prefers-reduced-motion.
 */
export function AchievementCelebration({ achievements }: { achievements: Achievement[] }) {
  const [celebrating, setCelebrating] = useState<number | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    const unlockedDays = achievements.filter((a) => a.unlocked).map((a) => a.days);
    if (unlockedDays.length === 0) return;
    const highestUnlocked = Math.max(...unlockedDays);

    let lastSeen = 0;
    try {
      lastSeen = Number(window.localStorage.getItem(STORAGE_KEY) ?? "0");
    } catch {
      lastSeen = 0;
    }
    if (!(highestUnlocked > lastSeen)) return;

    try {
      window.localStorage.setItem(STORAGE_KEY, String(highestUnlocked));
    } catch {
      // Private mode / storage disabled - celebration still shows for this page view, just won't be remembered.
    }

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setCelebrating(highestUnlocked);
    const timer = setTimeout(() => setCelebrating(null), prefersReduced ? 3200 : 2600);
    return () => clearTimeout(timer);
    // achievements is a fresh array each render by design (computeAchievements) - only the
    // unlocked-days contents matter here, and this effect only needs to run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (celebrating === null) return null;

  if (reducedMotion) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-6 right-6 z-50 rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm text-ink shadow-glow-gold backdrop-blur-md"
      >
        New achievement unlocked: {celebrating}-day streak.
      </div>
    );
  }

  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
      <div className="animate-burst-in rounded-2xl border border-gold/40 bg-surface-raised px-8 py-6 text-center shadow-glow-gold backdrop-blur-md">
        <p className="text-xs font-semibold uppercase tracking-wide text-gold">Achievement unlocked</p>
        <p className="mt-1 text-2xl font-bold text-glow text-ink">{celebrating}-day streak</p>
      </div>
    </div>
  );
}
