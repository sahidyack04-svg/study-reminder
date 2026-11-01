/**
 * Picks up to `count` items at random from `pool`, each item used at most once.
 * Fisher-Yates shuffle over a copy, so the caller's array is never mutated.
 * `rng` is injectable for deterministic tests; it defaults to Math.random.
 */
export function pickRandomQuestions<T>(pool: T[], count: number, rng: () => number = Math.random): T[] {
  const shuffled = [...pool];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, Math.max(0, Math.min(count, shuffled.length)));
}
