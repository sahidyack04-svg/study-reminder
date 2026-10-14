import { describe, it, expect } from "vitest";
import { validatePassword } from "@/lib/validation/password";

describe("validatePassword", () => {
  it("rejects passwords shorter than 10 characters", () => {
    expect(validatePassword("short1").valid).toBe(false);
  });

  it("accepts a password exactly 10 characters long", () => {
    expect(validatePassword("abcdefghij").valid).toBe(true);
  });

  it("rejects common passwords", () => {
    expect(validatePassword("password1").valid).toBe(false);
  });

  it("accepts a strong password", () => {
    expect(validatePassword("Tr0ub4dor&3xtra").valid).toBe(true);
  });
});
