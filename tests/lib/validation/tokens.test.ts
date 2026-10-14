import { describe, it, expect } from "vitest";
import { generateToken, isTokenExpired, tokenExpiryDate } from "@/lib/validation/tokens";

describe("token utilities", () => {
  it("generates a 64-character hex token", () => {
    const token = generateToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates unique tokens across calls", () => {
    expect(generateToken()).not.toBe(generateToken());
  });

  it("treats a token as expired exactly at its expiry instant", () => {
    const expiresAt = new Date("2026-10-14T10:00:00Z");
    expect(isTokenExpired(expiresAt, new Date("2026-10-14T10:00:00Z"))).toBe(true);
  });

  it("treats a token as not expired one millisecond before expiry", () => {
    const expiresAt = new Date("2026-10-14T10:00:00.001Z");
    expect(isTokenExpired(expiresAt, new Date("2026-10-14T10:00:00.000Z"))).toBe(false);
  });

  it("computes an expiry date N hours from now", () => {
    const asOf = new Date("2026-10-14T10:00:00Z");
    expect(tokenExpiryDate(24, asOf).toISOString()).toBe("2026-10-15T10:00:00.000Z");
  });
});
