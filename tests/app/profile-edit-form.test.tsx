import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProfileEditForm } from "@/app/(app)/profile/ProfileEditForm";

vi.mock("@/lib/onboarding/updateProfile", () => ({ updateStudentProfile: vi.fn() }));
vi.mock("@/lib/onboarding/guardianConsentActions", () => ({
  resendGuardianConsentForCurrentUser: vi.fn(),
}));
import { updateStudentProfile } from "@/lib/onboarding/updateProfile";
import { resendGuardianConsentForCurrentUser } from "@/lib/onboarding/guardianConsentActions";

const initial = {
  name: "Alex",
  dateOfBirth: "2010-01-01",
  grade: "9",
  schoolName: "Maple High",
  curriculum: "CBSE",
  academicYear: "2026-2027",
  timezone: "Asia/Kolkata",
};

describe("ProfileEditForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("submits the edited fields and shows a saved confirmation", async () => {
    (updateStudentProfile as any).mockResolvedValue({ success: true });
    render(<ProfileEditForm initial={initial} guardianStatus={null} />);

    fireEvent.change(screen.getByDisplayValue("Maple High"), { target: { value: "New School" } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(screen.getByText(/saved/i)).toBeInTheDocument());
    expect(updateStudentProfile).toHaveBeenCalledWith(expect.objectContaining({ schoolName: "New School" }));
  });

  it("shows the server error message when the update fails", async () => {
    (updateStudentProfile as any).mockResolvedValue({ success: false, error: "Profile not found." });
    render(<ProfileEditForm initial={initial} guardianStatus={null} />);

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(screen.getByText(/profile not found/i)).toBeInTheDocument());
  });

  it("offers a standalone resend button while guardian consent is still pending", async () => {
    (resendGuardianConsentForCurrentUser as any).mockResolvedValue({ success: true });
    render(
      <ProfileEditForm
        initial={initial}
        guardianStatus={{ email: "parent@example.test", approved: false }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /resend consent email/i }));

    await waitFor(() => expect(screen.getByText(/consent email sent again/i)).toBeInTheDocument());
    expect(resendGuardianConsentForCurrentUser).toHaveBeenCalledOnce();
    expect(updateStudentProfile).not.toHaveBeenCalled();
  });

  it("hides the resend button once the guardian has approved", () => {
    render(
      <ProfileEditForm
        initial={initial}
        guardianStatus={{ email: "parent@example.test", approved: true }}
      />,
    );
    expect(screen.queryByRole("button", { name: /resend consent email/i })).toBeNull();
  });
});
