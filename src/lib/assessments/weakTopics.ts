/**
 * A topic needs at least this many graded attempts before its wrong-rate is
 * surfaced at all — one lucky or unlucky guess is not a trend, and showing it
 * as a 100%/0% weak topic would be misleading.
 */
const MIN_ATTEMPTS = 2;

export interface TopicAttempt {
  topic: string;
  isCorrect: boolean;
}

export interface WeakTopic {
  topic: string;
  attempts: number;
  wrongRate: number; // 0-100
}

/**
 * Aggregates graded attempts into a per-topic wrong-rate, worst first.
 * Topics with fewer than MIN_ATTEMPTS attempts are filtered out *before*
 * sorting, so they can never appear in the result.
 */
export function computeWeakTopics(attempts: TopicAttempt[]): WeakTopic[] {
  const totals = new Map<string, { attempts: number; wrong: number }>();

  for (const attempt of attempts) {
    const entry = totals.get(attempt.topic) ?? { attempts: 0, wrong: 0 };
    entry.attempts += 1;
    if (!attempt.isCorrect) entry.wrong += 1;
    totals.set(attempt.topic, entry);
  }

  return [...totals.entries()]
    .filter(([, entry]) => entry.attempts >= MIN_ATTEMPTS)
    .map(([topic, entry]) => ({
      topic,
      attempts: entry.attempts,
      wrongRate: Math.round((entry.wrong / entry.attempts) * 100),
    }))
    .sort((a, b) => b.wrongRate - a.wrongRate);
}
