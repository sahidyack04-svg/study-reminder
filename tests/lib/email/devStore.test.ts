import { describe, it, expect, beforeEach } from "vitest";
import { recordDevEmail, getDevEmails, clearDevEmails } from "@/lib/email/devStore";

describe("devStore", () => {
  beforeEach(() => clearDevEmails());

  it("records and retrieves emails, most recent first", () => {
    recordDevEmail({ to: "a@example.test", subject: "First", body: "..." });
    recordDevEmail({ to: "b@example.test", subject: "Second", body: "..." });

    const emails = getDevEmails();
    expect(emails).toHaveLength(2);
    expect(emails[0].subject).toBe("Second");
  });

  it("caps stored emails at 50", () => {
    for (let i = 0; i < 55; i++) {
      recordDevEmail({ to: "a@example.test", subject: `#${i}`, body: "..." });
    }
    expect(getDevEmails()).toHaveLength(50);
  });
});
