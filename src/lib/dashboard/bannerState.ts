export type BannerState = "none" | "guardian-pending";

export function getDashboardBannerState(guardian: { consentGivenAt: Date | null } | null): BannerState {
  if (guardian && !guardian.consentGivenAt) return "guardian-pending";
  return "none";
}
