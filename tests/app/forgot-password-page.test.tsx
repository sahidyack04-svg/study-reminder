import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ForgotPasswordPage from "@/app/forgot-password/page";

vi.mock("@/lib/auth/passwordReset", () => ({ requestPasswordReset: vi.fn() }));

import { requestPasswordReset } from "@/lib/auth/passwordReset";

describe("ForgotPasswordPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the generic confirmation after submitting a valid-looking email", async () => {
    (requestPasswordReset as any).mockResolvedValue({ success: true });
    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "student@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText(/if an account exists/i)).toBeInTheDocument();
    });
    expect(requestPasswordReset).toHaveBeenCalledWith("student@example.test");
  });

  it("disables the submit button while the request is in flight, to prevent duplicate submissions", async () => {
    let resolveRequest: (value: { success: boolean }) => void = () => {};
    (requestPasswordReset as any).mockImplementation(
      () => new Promise((resolve) => { resolveRequest = resolve; }),
    );
    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "student@example.test" } });
    const button = screen.getByRole("button", { name: /send reset link/i });
    fireEvent.click(button);

    expect(button).toBeDisabled();
    expect(requestPasswordReset).toHaveBeenCalledTimes(1);

    fireEvent.click(button);
    expect(requestPasswordReset).toHaveBeenCalledTimes(1);

    resolveRequest({ success: true });
    await waitFor(() => {
      expect(screen.getByText(/if an account exists/i)).toBeInTheDocument();
    });
  });

  it("still shows the generic confirmation even if the request throws, without revealing an error", async () => {
    (requestPasswordReset as any).mockRejectedValue(new Error("network down"));
    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "student@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText(/if an account exists/i)).toBeInTheDocument();
    });
  });

  it("shows an honest unavailable message when the server reports no email provider", async () => {
    (requestPasswordReset as any).mockResolvedValue({ success: true, emailAvailable: false });
    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "student@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText(/temporarily unavailable/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/if an account exists/i)).not.toBeInTheDocument();
  });

  it("links back to the login page", () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByRole("link", { name: /back to login/i })).toHaveAttribute("href", "/login");
  });
});
