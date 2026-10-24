export function calculateAge(dateOfBirth: Date, asOf: Date = new Date()): number {
  let age = asOf.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const hasHadBirthdayThisYear =
    asOf.getUTCMonth() > dateOfBirth.getUTCMonth() ||
    (asOf.getUTCMonth() === dateOfBirth.getUTCMonth() && asOf.getUTCDate() >= dateOfBirth.getUTCDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

export function requiresGuardianConsent(dateOfBirth: Date, asOf: Date = new Date()): boolean {
  return calculateAge(dateOfBirth, asOf) < 18;
}

// Computes "today" as a UTC-midnight-anchored Date, using the CALENDAR DATE
// in the given IANA timezone rather than the host process's timezone. This
// mirrors how dateOfBirth is anchored (date-only ISO strings parse as UTC
// midnight), so calculateAge/requiresGuardianConsent compare two
// UTC-midnight-anchored calendar dates instead of mixing a UTC-anchored
// dateOfBirth with a real host-timezone-dependent instant for "now".
export function todayInTimezone(timezone: string): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  // en-CA locale formats as YYYY-MM-DD
  return new Date(`${parts}T00:00:00.000Z`);
}

// Computes the current wall-clock time in the given IANA timezone as a
// 24-hour "HH:mm" string, using the same Intl.DateTimeFormat-based approach
// as todayInTimezone (rather than reading the host process's local time or
// assuming UTC). Used by the daily-reminders cron route to compare "now" in
// a student's own timezone against their preferred reminder times and
// quiet-hours window, both of which are also stored as "HH:mm" strings.
export function currentTimeInTimezone(timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}

// Renders a UTC-midnight-anchored calendar date (PlanEntry.date,
// JournalEntry.date, etc.) for display. Plain toLocaleDateString() reads
// the date back in the HOST process's local timezone, which can roll a
// UTC-midnight date back a full day for any viewer west of UTC -- use this
// everywhere a stored calendar date is shown to a user, not the bare method.
export function formatUTCDate(date: Date): string {
  return date.toLocaleDateString(undefined, { timeZone: "UTC" });
}
