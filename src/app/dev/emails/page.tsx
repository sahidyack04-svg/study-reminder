import { notFound } from "next/navigation";
import { getDevEmails } from "@/lib/email/devStore";

export default function DevEmailsPage() {
  // This dev inbox exposes every verification/reset/consent link it has
  // logged, unauthenticated. It must never exist in a production build,
  // regardless of whether an email provider happens to be configured.
  if (process.env.NODE_ENV === "production") notFound();

  if (process.env.RESEND_API_KEY) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-ink-muted">
          A real email provider is configured, so emails are actually sent and this dev inbox is not used.
        </p>
      </main>
    );
  }

  const emails = getDevEmails();

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mb-6 text-2xl font-semibold text-brand">Dev email inbox</h1>
      <p className="mb-6 text-sm text-ink-muted">
        No email provider is configured, so verification/reset/consent emails appear here instead of being sent.
      </p>
      {emails.length === 0 ? (
        <p className="text-ink-muted">No emails yet.</p>
      ) : (
        <ul className="space-y-4">
          {emails.map((email, i) => (
            <li key={i} className="rounded-xl bg-brand-light p-4">
              <p className="text-sm text-ink-muted">
                To: {email.to} · {email.sentAt.toLocaleString()}
              </p>
              <p className="font-medium">{email.subject}</p>
              <pre className="mt-2 whitespace-pre-wrap text-sm">{email.body}</pre>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
