import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SignupPage from "@/app/signup/page";

vi.mock("@/lib/auth/signup", () => ({ signupStudent: vi.fn() }));
vi.mock("@/lib/auth/verifyEmail", () => ({ resendVerificationEmail: vi.fn() }));

import { signupStudent } from "@/lib/auth/signup";
import { resendVerificationEmail } from "@/lib/auth/verifyEmail";

function fillAndSubmit(password = "longenoughpassword1") {
  fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: "student@example.test" } });
  fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: password } });
  fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: /create account/i }));
}

describe("SignupPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows a check-your-email confirmation instead of signing the user in automatically", async () => {
    (signupStudent as any).mockResolvedValue({ success: true, emailDelivered: true });
    render(<SignupPage />);

    fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /create account/i })).not.toBeInTheDocument();
  });

  it("shows an honest message when the verification email could not be delivered", async () => {
    (signupStudent as any).mockResolvedValue({ success: true, emailDelivered: false });
    render(<SignupPage />);

    fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByText(/couldn.t send your verification email/i)).toBeInTheDocument();
    });
  });

  it("surfaces a signup error without showing the confirmation screen", async () => {
    (signupStudent as any).mockResolvedValue({ success: false, error: "An account with this email already exists." });
    render(<SignupPage />);

    fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByText(/already exists/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/check your email/i)).not.toBeInTheDocument();
  });

  it("lets the student resend the verification email from the confirmation screen", async () => {
    (signupStudent as any).mockResolvedValue({ success: true, emailDelivered: true });
    (resendVerificationEmail as any).mockResolvedValue({ success: true });
    render(<SignupPage />);

    fillAndSubmit();
    await waitFor(() => screen.getByText(/check your email/i));

    fireEvent.click(screen.getByRole("button", { name: /resend verification email/i }));

    await waitFor(() => {
      expect(resendVerificationEmail).toHaveBeenCalledWith("student@example.test");
    });
  });
});
