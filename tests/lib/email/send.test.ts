import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
    expect(result.reason).toBe("no_provider");
    expect(getDevEmails()).toHaveLength(1);
    expect(getDevEmails()[0].to).toBe("student@example.test");
  });
});

describe("sendEmail with a configured provider", () => {
  beforeEach(() => {
    clearDevEmails();
    vi.resetModules();
    vi.unmock("resend");
    process.env.RESEND_API_KEY = "test-api-key";
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
    vi.doUnmock("resend");
  });

  it("returns delivered:false with reason provider_error when Resend reports an error", async () => {
    vi.doMock("resend", () => ({
      Resend: class {
        emails = {
          send: vi.fn().mockResolvedValue({ data: null, error: { name: "validation_error", message: "test error" } }),
        };
      },
    }));

    const { sendEmail } = await import("@/lib/email/send");
    const result = await sendEmail({ to: "student@example.test", subject: "Hi", body: "Body" });

    expect(result).toEqual({ delivered: false, reason: "provider_error" });
  });

  it("returns delivered:false with reason provider_error when the send call throws", async () => {
    vi.doMock("resend", () => ({
      Resend: class {
        emails = {
          send: vi.fn().mockRejectedValue(new Error("network down")),
        };
      },
    }));

    const { sendEmail } = await import("@/lib/email/send");
    const result = await sendEmail({ to: "student@example.test", subject: "Hi", body: "Body" });

    expect(result).toEqual({ delivered: false, reason: "provider_error" });
  });

  it("returns delivered:true when Resend reports success", async () => {
    vi.doMock("resend", () => ({
      Resend: class {
        emails = {
          send: vi.fn().mockResolvedValue({ data: { id: "some-id" }, error: null }),
        };
      },
    }));

    const { sendEmail } = await import("@/lib/email/send");
    const result = await sendEmail({ to: "student@example.test", subject: "Hi", body: "Body" });

    expect(result.delivered).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("forwards an optional html body to the provider alongside the plain text", async () => {
    const sendSpy = vi.fn().mockResolvedValue({ data: { id: "some-id" }, error: null });
    vi.doMock("resend", () => ({
      Resend: class {
        emails = { send: sendSpy };
      },
    }));

    const { sendEmail } = await import("@/lib/email/send");
    await sendEmail({ to: "student@example.test", subject: "Hi", body: "Body", html: "<p>Body</p>" });

    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({ to: "student@example.test", text: "Body", html: "<p>Body</p>" }),
    );
  });
});
