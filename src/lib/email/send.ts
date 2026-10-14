import { Resend } from "resend";
import { recordDevEmail } from "./devStore";

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
}

export async function sendEmail({ to, subject, body }: SendEmailInput): Promise<{ delivered: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    recordDevEmail({ to, subject, body });
    console.log(`[dev email] to=${to} subject="${subject}"\n${body}`);
    return { delivered: false };
  }

  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM_EMAIL ?? "Study Reminder <onboarding@resend.dev>";
  await resend.emails.send({ from, to, subject, text: body });
  return { delivered: true };
}
