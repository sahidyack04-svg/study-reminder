import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useSearchParams } from "next/navigation";
import VerifyEmailPage from "@/app/verify-email/page";

vi.mock("next/navigation", () => ({ useSearchParams: vi.fn() }));
vi.mock("@/lib/auth/verifyEmail", () => ({
  verifyEmailToken: vi.fn(),
  resendVerificationEmail: vi.fn(),
}));

import { verifyEmailToken, resendVerificationEmail } from "@/lib/auth/verifyEmail";

function mockToken(token: string | null) {
  (useSearchParams as any).mockReturnValue({ get: (key: string) => (key === "token" ? token : null) });
}

describe("VerifyEmailPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows success and a link to login when the token is valid", async () => {
    mockToken("good-token");
    (verifyEmailToken as any).mockResolvedValue({ success: true });
    render(<VerifyEmailPage />);

    await waitFor(() => {
      expect(screen.getByText(/email verified/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /go to login/i })).toHaveAttribute("href", "/login");
  });

  it("shows the exact error and a resend form for an expired token", async () => {
    mockToken("expired-token");
    (verifyEmailToken as any).mockResolvedValue({ success: false, error: "This verification link has expired. Please request a new one." });
    render(<VerifyEmailPage />);

    await waitFor(() => {
      expect(screen.getByText(/link has expired/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /resend verification email/i })).toBeInTheDocument();
  });

  it("shows the resend form directly when no token is present", () => {
    mockToken(null);
    render(<VerifyEmailPage />);

    expect(screen.getByRole("button", { name: /resend verification email/i })).toBeInTheDocument();
    expect(verifyEmailToken).not.toHaveBeenCalled();
  });

  it("submits the resend form and shows a non-enumerating confirmation", async () => {
    mockToken(null);
    (resendVerificationEmail as any).mockResolvedValue({ success: true });
    render(<VerifyEmailPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "student@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: /resend verification email/i }));

    await waitFor(() => {
      expect(resendVerificationEmail).toHaveBeenCalledWith("student@example.test");
      expect(screen.getByText(/if an account exists/i)).toBeInTheDocument();
    });
  });
});
