import { describe, it, expect } from "vitest";
import { getDashboardBannerState } from "@/lib/dashboard/bannerState";

describe("getDashboardBannerState", () => {
  it("returns none when there is no guardian", () => {
    expect(getDashboardBannerState(null)).toBe("none");
  });

  it("returns guardian-pending when consent hasn't been given", () => {
    expect(getDashboardBannerState({ consentGivenAt: null })).toBe("guardian-pending");
  });

  it("returns none once consent has been given", () => {
    expect(getDashboardBannerState({ consentGivenAt: new Date() })).toBe("none");
  });
});
