import { describe, it, expect, vi, beforeEach } from "vitest";
import { clearDevEmails, getDevEmails } from "@/lib/email/devStore";

describe("sendEmail", () => {
  beforeEach(() => {
    clearDevEmails();
    vi.resetModules();
    delete process.env.RESEND_API_KEY;
  });

  it("records to the dev inbox instead of sending when RESEND_API_KEY is unset", async () => {
    const { sendEmail } = await import("@/lib/email/send");
    const result = await sendEmail({ to: "student@example.test", subject: "Hi", body: "Body" });

    expect(result.delivered).toBe(false);
    expect(getDevEmails()).toHaveLength(1);
    expect(getDevEmails()[0].to).toBe("student@example.test");
  });
});
