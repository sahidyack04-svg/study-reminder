import { describe, it, expect } from "vitest";
import { calculateAge, requiresGuardianConsent } from "@/lib/validation/age";

describe("age calculations", () => {
  it("calculates age correctly before a birthday has passed this year", () => {
    expect(calculateAge(new Date("2010-12-25"), new Date("2026-10-14"))).toBe(15);
  });

  it("calculates age correctly on the birthday itself", () => {
    expect(calculateAge(new Date("2008-10-14"), new Date("2026-10-14"))).toBe(18);
  });

  it("does not require guardian consent for a student turning exactly 18 today", () => {
    expect(requiresGuardianConsent(new Date("2008-10-14"), new Date("2026-10-14"))).toBe(false);
  });

  it("requires guardian consent for a student turning 18 tomorrow", () => {
    expect(requiresGuardianConsent(new Date("2008-10-15"), new Date("2026-10-14"))).toBe(true);
  });
});
