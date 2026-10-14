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
