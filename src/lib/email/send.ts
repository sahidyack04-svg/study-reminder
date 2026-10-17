import { Resend } from "resend";
import { recordDevEmail } from "./devStore";

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
  html?: string;
}

export async function sendEmail({
  to,
  subject,
  body,
  html,
}: SendEmailInput): Promise<{ delivered: boolean; reason?: "no_provider" | "provider_error" }> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    recordDevEmail({ to, subject, body, html });
    console.log(`[dev email] to=${to} subject="${subject}"\n${body}`);
    return { delivered: false, reason: "no_provider" };
  }

  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM_EMAIL ?? "Study Reminder <onboarding@resend.dev>";

  try {
    const result = await resend.emails.send({ from, to, subject, text: body, ...(html ? { html } : {}) });
    if (result.error) {
      console.error(
        `[email send error] to=${to} subject="${subject}" name=${result.error.name} message=${result.error.message}`,
      );
      return { delivered: false, reason: "provider_error" };
    }
    return { delivered: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[email send error] to=${to} subject="${subject}" message=${message}`);
    return { delivered: false, reason: "provider_error" };
  }
}
