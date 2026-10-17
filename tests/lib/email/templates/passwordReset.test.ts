import { describe, it, expect } from "vitest";
import { buildPasswordResetEmail } from "@/lib/email/templates/passwordReset";

describe("buildPasswordResetEmail", () => {
  const resetUrl = "http://localhost:3000/reset-password?token=abc123";

  it("includes the reset link in both the HTML and plain-text bodies", () => {
    const { html, text } = buildPasswordResetEmail({ resetUrl, expiryHours: 1 });
    expect(html).toContain(resetUrl);
    expect(text).toContain(resetUrl);
  });

  it("states the actual token expiry window", () => {
    const { html, text } = buildPasswordResetEmail({ resetUrl, expiryHours: 1 });
    expect(html).toMatch(/1 hour/i);
    expect(text).toMatch(/1 hour/i);
  });

  it("pluralizes a multi-hour expiry window", () => {
    const { html, text } = buildPasswordResetEmail({ resetUrl, expiryHours: 4 });
    expect(html).toMatch(/4 hours/i);
    expect(text).toMatch(/4 hours/i);
  });

  it("includes a note for recipients who did not request the reset", () => {
    const { html, text } = buildPasswordResetEmail({ resetUrl, expiryHours: 1 });
    expect(html).toMatch(/didn't request|did not request/i);
    expect(text).toMatch(/didn't request|did not request/i);
  });

  it("identifies the sender as Study Reminder", () => {
    const { html, text } = buildPasswordResetEmail({ resetUrl, expiryHours: 1 });
    expect(html).toMatch(/Study Reminder/);
    expect(text).toMatch(/Study Reminder/);
  });

  it("never includes a literal password value", () => {
    const { html, text } = buildPasswordResetEmail({ resetUrl, expiryHours: 1 });
    expect(html).not.toMatch(/your password is/i);
    expect(text).not.toMatch(/your password is/i);
  });
});
