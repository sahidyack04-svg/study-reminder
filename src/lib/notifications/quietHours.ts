// Quiet-hours containment for an "HH:mm" time against an "HH:mm" window.
//
// Shared deliberately by two callers that must agree exactly:
//  - src/app/api/cron/daily-reminders/route.ts evaluates it against the
//    CURRENT time in the student's timezone, to decide "is it okay to
//    disturb them right now?".
//  - src/lib/notifications/preferences.ts evaluates it against the
//    student's PREFERRED time at save time, to reject a configuration
//    whose preferred time sits permanently inside its own quiet window
//    (which would silently mean "never remind me again").
// A second, divergent implementation of this rule would let the form
// accept a configuration the cron route then suppresses forever.
//
// Two window shapes:
//  - same-day window (start < end), e.g. "09:00"-"17:00": inside if
//    start <= time < end.
//  - overnight window (start > end), e.g. "21:00"-"07:00": the window wraps
//    past midnight, so "inside" is time >= start (the late side, before
//    midnight) OR time < end (the early side, after midnight) -- a plain
//    start <= time < end range check would incorrectly treat this case
//    as *always* outside the window.
//
// A half-configured window (only one of start/end) suppresses nothing here;
// updatePreferences rejects that shape outright so it can no longer be saved.
export function isWithinQuietHours(
  time: string,
  start: string | null,
  end: string | null,
): boolean {
  if (!start || !end) return false;
  if (start < end) return time >= start && time < end;
  if (start > end) return time >= start || time < end;
  return false; // start === end: a zero-length window suppresses nothing
}
