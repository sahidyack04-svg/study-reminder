import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import GuardianConsentPage from "@/app/guardian-consent/[token]/page";

vi.mock("next/navigation", () => ({ useParams: () => ({ token: "t1" }) }));
vi.mock("@/lib/onboarding/guardianConsent", () => ({ approveGuardianConsent: vi.fn() }));

import { approveGuardianConsent } from "@/lib/onboarding/guardianConsent";

describe("GuardianConsentPage", () => {
  it("shows the approval confirmation after clicking approve", async () => {
    (approveGuardianConsent as any).mockResolvedValue({ success: true });
    render(<GuardianConsentPage />);

    fireEvent.click(screen.getByRole("button", { name: /i approve/i }));

    await waitFor(() => {
      expect(screen.getByText(/you've approved this student's account/i)).toBeInTheDocument();
    });
  });

  it("shows the already-approved message when the link was used before", async () => {
    (approveGuardianConsent as any).mockResolvedValue({ success: true, alreadyApproved: true });
    render(<GuardianConsentPage />);

    fireEvent.click(screen.getByRole("button", { name: /i approve/i }));

    await waitFor(() => {
      expect(screen.getByText(/already approved/i)).toBeInTheDocument();
    });
  });

  it("shows the error message for an invalid token", async () => {
    (approveGuardianConsent as any).mockResolvedValue({ success: false, error: "This consent link is invalid." });
    render(<GuardianConsentPage />);

    fireEvent.click(screen.getByRole("button", { name: /i approve/i }));

    await waitFor(() => {
      expect(screen.getByText(/this consent link is invalid/i)).toBeInTheDocument();
    });
  });
});
