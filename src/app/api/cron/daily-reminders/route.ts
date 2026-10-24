import { prisma } from "@/lib/db/prisma";
import { sendEmail } from "@/lib/email/send";
import { todayInTimezone, currentTimeInTimezone } from "@/lib/validation/age";

// This route has no NextAuth session involved at all -- Vercel Cron calls it
// on a schedule (see vercel.json) and authenticates with a shared secret
// instead of a browser session. It MUST be checked and rejected before any
// database access happens, since it is otherwise a completely open endpoint.
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // never allow access if the secret isn't configured at all
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

// "Has the student's reminder time for today already arrived?" -- a
// catch-up check (current >= some configured preferred time), not an exact
// match. The cron fires on a fixed schedule (see vercel.json), so a preferred
// time of e.g. "08:00" should fire on whichever invocation first reaches or
// passes 08:00 that day, not only on an invocation landing on that exact
// minute. Per-day idempotency is handled separately by ReminderLog.
function hasReachedAPreferredTime(current: string, preferredTimes: string[]): boolean {
  return preferredTimes.some((preferred) => current >= preferred);
}

// Quiet-hours containment, evaluated against the CURRENT time in the
// student's timezone (not the preferred time) -- quiet hours describe when
// it is currently not okay to disturb the student, independent of which
// configured preferred time caused this invocation to consider sending.
//
// Two shapes:
//  - same-day window (start < end), e.g. "09:00"-"17:00": inside if
//    start <= current < end.
//  - overnight window (start > end), e.g. "21:00"-"07:00": the window wraps
//    past midnight, so "inside" is current >= start (the late side, before
//    midnight) OR current < end (the early side, after midnight) -- a plain
//    start <= current < end range check would incorrectly treat this case
//    as *always* outside the window.
function isWithinQuietHours(current: string, start: string | null, end: string | null): boolean {
  if (!start || !end) return false;
  if (start < end) return current >= start && current < end;
  if (start > end) return current >= start || current < end;
  return false; // start === end: a zero-length window suppresses nothing
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return new Response(null, { status: 401 });
  }

  const profiles = await prisma.studentProfile.findMany({
    where: { reminderPreference: { channel: { not: "none" } } },
    include: { reminderPreference: true, user: true },
  });

  let processed = 0;
  let failed = 0;

  for (const profile of profiles) {
    // One corrupt row (e.g. unparsable preferredTimes) or one transient
    // Prisma error must not abort the whole run -- every student later in
    // `profiles` would otherwise silently stop getting reminders, every
    // hour, until someone notices. Isolate each profile's work so a single
    // failure is logged and skipped, not fatal to the request.
    try {
      const preference = profile.reminderPreference;
      if (!preference) continue;

      const current = currentTimeInTimezone(profile.timezone);
      const preferredTimes: string[] = JSON.parse(preference.preferredTimes);

      if (!hasReachedAPreferredTime(current, preferredTimes)) continue;
      if (isWithinQuietHours(current, preference.quietHoursStart, preference.quietHoursEnd)) continue;

      const channel = preference.channel as "email" | "whatsapp";
      // Stored calendar date, anchored the same way as every other
      // date-only column in this codebase -- never a bare `new Date()`.
      const today = todayInTimezone(profile.timezone);

      await prisma.$transaction(
        async (tx) => {
          // Same advisory-lock pattern as checkRateLimit in
          // src/lib/security/rateLimit.ts: Postgres READ COMMITTED lets two
          // concurrent invocations both read "no ReminderLog row yet" before
          // either commits, so a plain check-then-create still double-sends
          // under concurrency. The lock serializes exactly the invocations
          // that share this student/date/channel key; it's released
          // automatically when the transaction commits or rolls back.
          const lockKey = `reminder:${profile.id}:${today.toISOString().slice(0, 10)}:${channel}`;
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

          const existing = await tx.reminderLog.findUnique({
            where: {
              studentProfileId_date_channel: {
                studentProfileId: profile.id,
                date: today,
                channel,
              },
            },
          });
          if (existing) return; // already sent today on this channel -- skip

          const openTaskCount = await tx.task.count({
            where: { studentProfileId: profile.id, status: "open" },
          });

          let delivered = false;
          if (channel === "email") {
            const result = await sendEmail({
              to: profile.user?.email ?? "",
              subject: "Your study reminder",
              body: `You have ${openTaskCount} open task${openTaskCount === 1 ? "" : "s"} waiting. Keep up the momentum!`,
            });
            delivered = result.delivered;
          } else {
            // channel === "whatsapp": no WhatsApp provider is wired up yet.
            // This is a deliberate, honest skip -- record that nothing was
            // delivered rather than calling anything that could be mistaken
            // for a real send.
            delivered = false;
          }

          await tx.reminderLog.create({
            data: { studentProfileId: profile.id, date: today, channel, delivered },
          });
        },
        // The default interactive-transaction timeout (5s) covers the lock
        // plus two cheap queries, but sendEmail also runs inside the lock --
        // a slow outbound call could blow the default timeout and abort the
        // transaction AFTER the email went out but BEFORE the ReminderLog
        // row commits, reproducing the exact duplicate-send this whole
        // design exists to prevent. Extra headroom here is cheap insurance.
        { timeout: 10_000 },
      );

      processed += 1;
    } catch (error) {
      // Message only -- never log the raw error object, which could embed
      // request payloads or provider response bodies.
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[cron/daily-reminders] failed for studentProfileId=${profile.id}: ${message}`);
      failed += 1;
    }
  }

  return Response.json({ processed, failed });
}
